package org.capstone.service;

import org.capstone.entity.Place;
import org.capstone.repository.MoveTimeRepository;
import org.capstone.repository.PlaceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 순서 변경 방식 비교: 같은 동시 드래그 상황에서 충돌이 얼마나 나는지 잰다 (DB 없이 메모리 저장소로).
 *
 * 예전 방식 (최종 순서 전송)
 *   클라이언트가 자기 화면의 순서로 최종 순서를 계산해, 장소마다 PUT /place/{id}로 next_place_id를 병렬 저장했다.
 *   (당시 PlaceService.updatePlace는 받은 next_place_id를 그대로 덮어썼다 → 테스트에서 그대로 재현)
 *
 * 지금 방식 (이동 명령 전송)
 *   클라이언트는 "이 장소를 몇 번째로"만 보내고, 서버(PlaceOrderService.move)가 일차 잠금 안에서
 *   최신 순서를 다시 읽어 적용한 뒤 트랜잭션 하나로 저장한다.
 *
 * 매 시도마다 같은 화면(초기 순서)을 보던 사용자 3명이 동시에 서로 다른 장소를 드래그한다.
 * 결과는 다음 셋 중 하나로 분류한다.
 *   - 정상: 최종 순서가 세 이동을 "어떤 순서로든 하나씩" 적용한 결과와 같다
 *   - 변경 유실: 연결은 멀쩡하지만 누군가의 이동이 다른 사람 저장에 덮여 사라졌다
 *   - 순서 손상: 연결이 끊기거나 순환이 생겨 장소가 화면에서 사라진다
 */
class PlaceReorderConflictTest {

    private static final long TRAVEL = 99L;
    private static final int DAY = 1;
    private static final int PLACES = 8;
    private static final int USERS = 3;
    private static final int TRIALS = 200;
    private static final long SEED = 42;

    private final Map<Integer, Place> db = new ConcurrentHashMap<>();
    private final AtomicInteger idSeq = new AtomicInteger(100);
    private PlaceOrderService service;
    private ExecutorService pool;

    private record Move(int placeId, int toIndex) {}

    private enum Outcome { 정상, 변경_유실, 순서_손상 }

    /** 사용자 한 명의 드래그가 저장 완료되기까지 걸린 시간 (방식별) */
    private final Map<Boolean, Queue<Long>> latenciesMicros = Map.of(
            true, new ConcurrentLinkedQueue<>(), false, new ConcurrentLinkedQueue<>());

    @BeforeEach
    void setUp() {
        PlaceRepository placeRepo = mock(PlaceRepository.class);
        when(placeRepo.findByTravelId(anyLong())).thenAnswer(inv -> {
            dbLatency();
            Long travelId = inv.getArgument(0);
            return db.values().stream().filter(p -> travelId.equals(p.getTravelId()))
                    .map(PlaceReorderConflictTest::copy).collect(Collectors.toList());
        });
        when(placeRepo.saveAll(anyIterable())).thenAnswer(inv -> {
            Iterable<Place> places = inv.getArgument(0);
            for (Place p : places) {
                db.put(p.getPlace_id(), copy(p));
                dbLatency();
            }
            return places;
        });
        when(placeRepo.save(any(Place.class))).thenAnswer(inv -> {
            Place p = inv.getArgument(0);
            if (p.getPlace_id() == 0) p.setPlace_id(idSeq.incrementAndGet());
            db.put(p.getPlace_id(), copy(p));
            return p;
        });

        MoveTimeRepository moveTimeRepo = mock(MoveTimeRepository.class);
        when(moveTimeRepo.findByDeparturePlace(anyInt())).thenReturn(List.of());

        PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);
        when(txManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());

        service = new PlaceOrderService(placeRepo, moveTimeRepo, new TransactionTemplate(txManager), mock(SimpMessagingTemplate.class));
        pool = Executors.newFixedThreadPool(USERS * PLACES);
    }

    @Test
    void 이동_명령_방식이_최종_순서_전송_방식보다_충돌이_적다() throws Exception {
        Map<Outcome, Integer> legacy = run(true);
        Map<Outcome, Integer> current = run(false);
        pool.shutdown();

        double legacyConflict = conflictRate(legacy);
        double currentConflict = conflictRate(current);

        System.out.printf("""

                ===== 순서 변경 충돌 비교 (동시 사용자 %d명, 장소 %d개, %d회 시도) =====
                                         정상     변경 유실   순서 손상   충돌률    저장 지연 p50 / p95
                예전: 최종 순서 전송    %4d       %4d        %4d      %5.1f%%    %6.2fms / %6.2fms
                지금: 이동 명령 전송    %4d       %4d        %4d      %5.1f%%    %6.2fms / %6.2fms
                ※ 지연은 메모리 저장소에 넣은 가짜 DB 지연(조회·저장 1건당 1ms) 기준이라 절대값보다 비율을 본다
                =====================================================================
                """,
                USERS, PLACES, TRIALS,
                legacy.get(Outcome.정상), legacy.get(Outcome.변경_유실), legacy.get(Outcome.순서_손상), legacyConflict,
                percentileMs(latenciesMicros.get(true), 0.50), percentileMs(latenciesMicros.get(true), 0.95),
                current.get(Outcome.정상), current.get(Outcome.변경_유실), current.get(Outcome.순서_손상), currentConflict,
                percentileMs(latenciesMicros.get(false), 0.50), percentileMs(latenciesMicros.get(false), 0.95));

        assertEquals(0, current.get(Outcome.변경_유실), "지금 방식에서 변경이 유실됨");
        assertEquals(0, current.get(Outcome.순서_손상), "지금 방식에서 순서가 손상됨");
        assertTrue(legacyConflict > currentConflict, "예전 방식보다 충돌이 줄지 않음");
    }

    /** 같은 시나리오(시드 고정)를 한 방식으로 TRIALS번 돌려 결과를 센다 */
    private Map<Outcome, Integer> run(boolean legacy) throws Exception {
        Map<Outcome, Integer> result = new EnumMap<>(Outcome.class);
        for (Outcome o : Outcome.values()) result.put(o, 0);
        Random random = new Random(SEED);

        for (int t = 0; t < TRIALS; t++) {
            List<Integer> initial = reset();
            List<Move> moves = randomMoves(initial, random);

            CountDownLatch start = new CountDownLatch(1);
            long[] startedAt = new long[1];
            Queue<Long> latencies = latenciesMicros.get(legacy);
            List<Future<?>> futures = new ArrayList<>();
            for (Move move : moves) {
                if (legacy) {
                    // 각자 자기 화면(initial)에서 최종 순서를 계산해, 장소마다 PUT을 병렬로 보낸다
                    // 이 사용자의 PUT이 전부 끝난 시점을 저장 완료로 본다 (프론트의 Promise.all)
                    List<Integer> mine = apply(initial, move);
                    AtomicInteger remaining = new AtomicInteger(mine.size());
                    for (int i = 0; i < mine.size(); i++) {
                        int placeId = mine.get(i);
                        Integer next = i + 1 < mine.size() ? mine.get(i + 1) : null;
                        futures.add(pool.submit(() -> {
                            await(start);
                            legacyPut(placeId, next);
                            if (remaining.decrementAndGet() == 0) latencies.add((System.nanoTime() - startedAt[0]) / 1000);
                            return null;
                        }));
                    }
                } else {
                    futures.add(pool.submit(() -> {
                        await(start);
                        service.move(TRAVEL, DAY, move.placeId(), move.toIndex(), "u");
                        latencies.add((System.nanoTime() - startedAt[0]) / 1000);
                        return null;
                    }));
                }
            }
            startedAt[0] = System.nanoTime();
            start.countDown(); // 모두 같은 순간에 출발
            for (Future<?> f : futures) f.get(10, TimeUnit.SECONDS);

            Outcome o = classify(initial, moves);
            result.merge(o, 1, Integer::sum);
        }
        return result;
    }

    /** 예전 PUT /place/{id}: DB에서 읽고 → 받은 next_place_id로 덮어쓰고 → 저장 (요청마다 따로, 잠금 없음) */
    private void legacyPut(int placeId, Integer next) {
        jitter(); // 요청마다 네트워크 도착 시각이 다르다
        Place place = copy(db.get(placeId));
        dbLatency();
        place.setNext_place_id(next);
        db.put(placeId, place);
    }

    private Outcome classify(List<Integer> initial, List<Move> moves) {
        List<Integer> chain = chainFromDb();
        boolean intact = chain.size() == PLACES && new HashSet<>(chain).size() == PLACES
                && db.values().stream().filter(p -> p.getNext_place_id() == null).count() == 1;
        if (!intact) return Outcome.순서_손상;

        // 세 이동을 어떤 순서로든 하나씩 적용한 결과 중 하나와 같으면 아무 변경도 사라지지 않은 것
        for (List<Move> order : permutations(moves)) {
            List<Integer> expected = initial;
            for (Move m : order) expected = apply(expected, m);
            if (expected.equals(chain)) return Outcome.정상;
        }
        return Outcome.변경_유실;
    }

    // ───────── 도우미 ─────────

    private List<Integer> reset() {
        db.clear();
        List<Integer> ids = new ArrayList<>();
        for (int i = 0; i < PLACES; i++) ids.add(idSeq.incrementAndGet());
        for (int i = 0; i < PLACES; i++) {
            Place p = new Place();
            p.setPlace_id(ids.get(i));
            p.setPlace_name("장소" + i);
            p.setTravelId(TRAVEL);
            p.setSelected_day(DAY);
            p.setNext_place_id(i + 1 < PLACES ? ids.get(i + 1) : null);
            db.put(p.getPlace_id(), p);
        }
        return ids;
    }

    /** 사용자마다 서로 다른 장소를, 실제로 위치가 바뀌는 곳으로 옮긴다 */
    private static List<Move> randomMoves(List<Integer> order, Random random) {
        List<Integer> candidates = new ArrayList<>(order);
        Collections.shuffle(candidates, random);
        List<Move> moves = new ArrayList<>();
        for (int u = 0; u < USERS; u++) {
            int placeId = candidates.get(u);
            int from = order.indexOf(placeId);
            int to;
            do { to = random.nextInt(order.size()); } while (to == from);
            moves.add(new Move(placeId, to));
        }
        return moves;
    }

    /** 화면의 드래그와 서버의 move가 같은 규칙: 빼서 toIndex 자리에 끼운다 */
    private static List<Integer> apply(List<Integer> order, Move move) {
        List<Integer> result = new ArrayList<>(order);
        result.remove(Integer.valueOf(move.placeId()));
        result.add(Math.max(0, Math.min(move.toIndex(), result.size())), move.placeId());
        return result;
    }

    private static List<List<Move>> permutations(List<Move> moves) {
        if (moves.isEmpty()) return List.of(List.of());
        List<List<Move>> all = new ArrayList<>();
        for (Move first : moves) {
            List<Move> rest = new ArrayList<>(moves);
            rest.remove(first);
            for (List<Move> tail : permutations(rest)) {
                List<Move> p = new ArrayList<>();
                p.add(first);
                p.addAll(tail);
                all.add(p);
            }
        }
        return all;
    }

    private static double percentileMs(Collection<Long> micros, double p) {
        List<Long> sorted = micros.stream().sorted().toList();
        if (sorted.isEmpty()) return 0;
        return sorted.get(Math.max((int) Math.ceil(p * sorted.size()) - 1, 0)) / 1000.0;
    }

    private static double conflictRate(Map<Outcome, Integer> r) {
        return (r.get(Outcome.변경_유실) + r.get(Outcome.순서_손상)) * 100.0 / TRIALS;
    }

    /** DB의 next_place_id를 시작점부터 따라간 순서 (순환이면 멈춘다) */
    private List<Integer> chainFromDb() {
        List<Place> day = new ArrayList<>(db.values());
        Set<Integer> referenced = day.stream().map(Place::getNext_place_id).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Integer, Place> byId = day.stream().collect(Collectors.toMap(Place::getPlace_id, p -> p));
        Place cur = day.stream().filter(p -> !referenced.contains(p.getPlace_id())).findFirst().orElse(null);
        List<Integer> chain = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();
        while (cur != null && seen.add(cur.getPlace_id())) {
            chain.add(cur.getPlace_id());
            cur = cur.getNext_place_id() == null ? null : byId.get(cur.getNext_place_id());
        }
        return chain;
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static void dbLatency() {
        sleepMillis(1);
    }

    private static void jitter() {
        sleepMillis(ThreadLocalRandom.current().nextInt(3));
    }

    private static void sleepMillis(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static Place copy(Place s) {
        Place p = new Place();
        p.setPlace_id(s.getPlace_id());
        p.setPlace_name(s.getPlace_name());
        p.setTravelId(s.getTravelId());
        p.setSelected_day(s.getSelected_day());
        p.setNext_place_id(s.getNext_place_id());
        p.setPlace_visiting_time(s.getPlace_visiting_time());
        return p;
    }
}
