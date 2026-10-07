package org.capstone.service;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.MoveTime;
import org.capstone.entity.Place;
import org.capstone.entity.WebSocketMessage;
import org.capstone.repository.MoveTimeRepository;
import org.capstone.repository.PlaceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * 하루치 장소 순서(next_place_id로 이어진 연결 리스트)를 바꾸는 작업을 서버에서 한 곳에 모아 처리한다.
 *
 * 왜 필요한가:
 *  - 예전에는 클라이언트가 최종 순서를 계산해 장소마다 PUT으로 저장했다.
 *    두 사람이 동시에 바꾸면 각자 옛 순서를 기준으로 계산한 값이 서로 덮어썼고,
 *    요청 일부만 성공하면 연결이 끊기거나 순환이 생겨 장소가 화면에서 사라질 수 있었다.
 *
 * 어떻게 막는가:
 *  1. 클라이언트는 "이 장소를 몇 번째로" 같은 이동 명령만 보낸다.
 *  2. (여행 ID, 일차)마다 잠금을 걸어 같은 날의 순서 변경(이동·추가·삭제)을 한 번에 하나씩 처리한다.
 *  3. 처리할 때마다 DB에서 최신 순서를 다시 읽고, 바꾼 결과를 트랜잭션 하나로 저장한다(전부 성공 아니면 전부 취소).
 *  4. 저장이 끝나면 서버가 확정된 순서를 소켓(ORDER_SYNC)으로 모든 사용자에게 보낸다.
 *
 * 한계: 잠금이 서버 메모리에 있으므로 서버가 1대일 때만 유효하다. 여러 대라면 DB 잠금이나 Redis 잠금이 필요하다.
 */
@Service
@RequiredArgsConstructor
public class PlaceOrderService {

    private static final long LOCK_WAIT_SECONDS = 5;
    private static final LocalTime NO_TIME = LocalTime.MIDNIGHT; // 프론트에서 00:00:00은 "미정"으로 표시

    private final PlaceRepository placeRepository;
    private final MoveTimeRepository moveTimeRepository;
    private final TransactionTemplate transactionTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    private final Map<String, ReentrantLock> dayLocks = new ConcurrentHashMap<>();

    // ───────────────────────── 공개 작업 ─────────────────────────

    /** placeId를 같은 날 순서의 toIndex 위치로 옮긴다. 확정된 순서(장소 id 목록)를 돌려준다. */
    public List<Integer> move(Long travelId, int day, int placeId, int toIndex, String userId) {
        List<Integer> order = withDayLock(travelId, day, () -> transactionTemplate.execute(status -> {
            List<Place> ordered = loadOrderedDay(travelId, day);
            Place target = ordered.stream()
                    .filter(p -> p.getPlace_id() == placeId)
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "이 날짜에 없는 장소입니다: " + placeId));

            // 최신 순서에서 빼고, 요청 위치에 끼운다 (범위를 벗어나면 끝에 맞춤)
            ordered.remove(target);
            ordered.add(Math.max(0, Math.min(toIndex, ordered.size())), target);

            // 순서가 바뀌면 방문시간·이동시간은 의미가 없어지므로 그날 것을 초기화한다
            ordered.forEach(p -> p.setPlace_visiting_time(NO_TIME));
            deleteMoveTimes(ordered);

            saveLinks(ordered);
            return ids(ordered);
        }));
        broadcastOrder(travelId, day, order, userId);
        return order;
    }

    /** 새 장소를 그날 순서의 맨 뒤에 붙여 저장한다. */
    public Place append(Place newPlace) {
        Long travelId = newPlace.getTravelId();
        int day = newPlace.getSelected_day() == null ? 1 : newPlace.getSelected_day();
        return withDayLock(travelId, day, () -> transactionTemplate.execute(status -> {
            List<Place> ordered = loadOrderedDay(travelId, day);
            newPlace.setNext_place_id(null);
            Place saved = placeRepository.save(newPlace);
            ordered.add(saved);
            saveLinks(ordered);
            return saved;
        }));
    }

    /** 장소를 삭제하고 앞뒤를 다시 이어 붙인다. */
    public void remove(int placeId) {
        Place place = placeRepository.findById(placeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "장소가 없습니다: " + placeId));
        Long travelId = place.getTravelId();
        int day = place.getSelected_day() == null ? 1 : place.getSelected_day();

        withDayLock(travelId, day, () -> transactionTemplate.execute(status -> {
            List<Place> ordered = loadOrderedDay(travelId, day);
            int idx = indexOf(ordered, placeId);
            if (idx < 0) return null; // 이미 다른 요청이 지운 경우

            // 앞 장소 → 지운 장소로 가던 이동시간, 지운 장소에서 출발하던 이동시간도 함께 정리
            if (idx > 0) deleteMoveTimes(List.of(ordered.get(idx - 1)));
            deleteMoveTimes(List.of(ordered.get(idx)));

            ordered.remove(idx);
            placeRepository.deleteById(placeId);
            saveLinks(ordered);
            return null;
        }));
    }

    // ───────────────────────── 내부 도구 ─────────────────────────

    /** (여행, 일차) 잠금 안에서 작업을 실행한다. 트랜잭션 커밋까지 잠금 안에서 끝나야 다음 요청이 최신 값을 본다. */
    private <T> T withDayLock(Long travelId, int day, Supplier<T> work) {
        ReentrantLock lock = dayLocks.computeIfAbsent(travelId + ":" + day, k -> new ReentrantLock(true));
        boolean locked = false;
        try {
            locked = lock.tryLock(LOCK_WAIT_SECONDS, TimeUnit.SECONDS);
            if (!locked) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "다른 사용자가 순서를 바꾸는 중입니다. 잠시 후 다시 시도해주세요.");
            }
            return work.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "순서 변경이 중단되었습니다.");
        } finally {
            if (locked) lock.unlock();
        }
    }

    /**
     * DB에서 그날 장소들을 읽어 next_place_id 연결대로 정렬한다.
     * 예전 버그로 연결이 끊기거나 순환이 생긴 데이터도 빠짐없이 복구되도록, 따라가지 못한 장소는 뒤에 붙인다.
     */
    private List<Place> loadOrderedDay(Long travelId, int day) {
        List<Place> dayPlaces = placeRepository.findByTravelId(travelId).stream()
                .filter(p -> p.getSelected_day() != null && p.getSelected_day() == day)
                .sorted(Comparator.comparingInt(Place::getPlace_id))
                .collect(Collectors.toList());

        Map<Integer, Place> byId = new LinkedHashMap<>();
        dayPlaces.forEach(p -> byId.put(p.getPlace_id(), p));
        Set<Integer> referenced = dayPlaces.stream()
                .map(Place::getNext_place_id)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<Place> ordered = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();
        Place current = dayPlaces.stream().filter(p -> !referenced.contains(p.getPlace_id())).findFirst().orElse(null);
        while (current != null && seen.add(current.getPlace_id())) {
            ordered.add(current);
            Integer next = current.getNext_place_id();
            current = next == null ? null : byId.get(next);
        }
        // 연결에서 빠진 장소(끊긴 체인·순환)는 id 순으로 뒤에 붙여 복구
        dayPlaces.stream().filter(p -> !seen.contains(p.getPlace_id())).forEach(ordered::add);
        return ordered;
    }

    /** 리스트 순서대로 next_place_id를 다시 이어 저장한다. */
    private void saveLinks(List<Place> ordered) {
        for (int i = 0; i < ordered.size(); i++) {
            Integer next = i + 1 < ordered.size() ? ordered.get(i + 1).getPlace_id() : null;
            ordered.get(i).setNext_place_id(next);
        }
        placeRepository.saveAll(ordered);
    }

    private void deleteMoveTimes(List<Place> places) {
        for (Place p : places) {
            List<MoveTime> times = moveTimeRepository.findByDeparturePlace(p.getPlace_id());
            if (!times.isEmpty()) moveTimeRepository.deleteAll(times);
        }
    }

    private static int indexOf(List<Place> ordered, int placeId) {
        for (int i = 0; i < ordered.size(); i++) {
            if (ordered.get(i).getPlace_id() == placeId) return i;
        }
        return -1;
    }

    private static List<Integer> ids(List<Place> ordered) {
        return ordered.stream().map(Place::getPlace_id).collect(Collectors.toList());
    }

    /** 확정된 순서를 같은 여행의 모든 사용자(요청한 사람 포함)에게 보낸다. */
    private void broadcastOrder(Long travelId, int day, List<Integer> order, String userId) {
        WebSocketMessage message = new WebSocketMessage();
        message.setType("ORDER_SYNC");
        message.setTravelId(travelId.intValue());
        message.setUserId(userId);
        message.setNewValue(Map.of("selectedDay", day, "order", order));
        message.setTimestamp(System.currentTimeMillis());
        messagingTemplate.convertAndSend("/topic/" + travelId, message);
    }
}
