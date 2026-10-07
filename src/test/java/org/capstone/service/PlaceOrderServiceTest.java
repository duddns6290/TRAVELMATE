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
 * PlaceOrderService 검증 (DB 없이 메모리 저장소로).
 * 핵심: 여러 사용자가 동시에 순서를 바꾸거나 장소를 추가·삭제해도 하루 순서(연결 리스트)가 깨지지 않아야 한다.
 */
class PlaceOrderServiceTest {

    private static final long TRAVEL = 99L;
    private static final int DAY = 1;

    /** DB 흉내: 저장/조회할 때마다 복사본을 주고받아, 트랜잭션마다 "DB에서 다시 읽는" 상황을 재현한다. */
    private final Map<Integer, Place> db = new ConcurrentHashMap<>();
    private final AtomicInteger idSeq = new AtomicInteger(100);
    private PlaceOrderService service;

    @BeforeEach
    void setUp() {
        PlaceRepository placeRepo = mock(PlaceRepository.class);
        when(placeRepo.findByTravelId(anyLong())).thenAnswer(inv -> {
            dbLatency(); // 실제 DB처럼 조회에 시간이 걸려야 동시 요청이 서로 겹친다
            Long travelId = inv.getArgument(0);
            return db.values().stream().filter(p -> travelId.equals(p.getTravelId())).map(PlaceOrderServiceTest::copy)
                    .collect(Collectors.toList());
        });
        when(placeRepo.saveAll(anyIterable())).thenAnswer(inv -> {
            Iterable<Place> places = inv.getArgument(0);
            for (Place p : places) {
                db.put(p.getPlace_id(), copy(p));
                dbLatency(); // 여러 행을 쓰는 동안에도 다른 요청이 끼어들 수 있게
            }
            return places;
        });
        when(placeRepo.save(any(Place.class))).thenAnswer(inv -> {
            Place p = inv.getArgument(0);
            if (p.getPlace_id() == 0) p.setPlace_id(idSeq.incrementAndGet());
            db.put(p.getPlace_id(), copy(p));
            return p;
        });
        when(placeRepo.findById(anyInt())).thenAnswer(inv -> Optional.ofNullable(db.get((Integer) inv.getArgument(0))).map(PlaceOrderServiceTest::copy));
        doAnswer(inv -> db.remove((Integer) inv.getArgument(0))).when(placeRepo).deleteById(anyInt());

        MoveTimeRepository moveTimeRepo = mock(MoveTimeRepository.class);
        when(moveTimeRepo.findByDeparturePlace(anyInt())).thenReturn(List.of());

        PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);
        when(txManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());

        service = new PlaceOrderService(placeRepo, moveTimeRepo, new TransactionTemplate(txManager), mock(SimpMessagingTemplate.class));
    }

    @Test
    void 이동하면_요청한_위치에_들어가고_연결이_다시_이어진다() {
        List<Integer> ids = seed(5); // A B C D E
        List<Integer> order = service.move(TRAVEL, DAY, ids.get(0), 3, "u1"); // A를 4번째로

        assertEquals(List.of(ids.get(1), ids.get(2), ids.get(3), ids.get(0), ids.get(4)), order);
        assertEquals(order, chainFromDb());
    }

    @Test
    void 끊어지거나_순환된_예전_데이터도_빠짐없이_복구된다() {
        List<Integer> ids = seed(3);
        // 예전 버그 재현: A.next=B, B.next=A (순환), C는 연결에서 빠짐
        db.get(ids.get(0)).setNext_place_id(ids.get(1));
        db.get(ids.get(1)).setNext_place_id(ids.get(0));
        db.get(ids.get(2)).setNext_place_id(null);

        List<Integer> order = service.move(TRAVEL, DAY, ids.get(2), 0, "u1");

        assertEquals(new HashSet<>(ids), new HashSet<>(order), "장소가 하나도 사라지면 안 된다");
        assertEquals(order, chainFromDb());
    }

    @Test
    void 추가와_삭제도_연결을_유지한다() {
        List<Integer> ids = seed(3);
        Place added = service.append(newPlace("추가"));
        service.remove(ids.get(1));

        assertEquals(List.of(ids.get(0), ids.get(2), added.getPlace_id()), chainFromDb());
    }

    @Test
    void 여러_사용자가_동시에_이동_추가_삭제해도_순서가_깨지지_않는다() throws Exception {
        List<Integer> ids = seed(8);
        ExecutorService pool = Executors.newFixedThreadPool(8);
        Random random = new Random(42);
        List<Callable<Void>> jobs = new ArrayList<>();

        for (int i = 0; i < 400; i++) {
            int kind = random.nextInt(10);
            int toIndex = random.nextInt(10);
            jobs.add(() -> {
                List<Integer> current = chainFromDb();
                if (current.isEmpty()) return null;
                int target = current.get(ThreadLocalRandom.current().nextInt(current.size()));
                try {
                    if (kind < 8) service.move(TRAVEL, DAY, target, toIndex, "u" + Thread.currentThread().getId());
                    else if (kind == 8) service.append(newPlace("동시추가"));
                    else if (current.size() > 3) service.remove(target);
                } catch (org.springframework.web.server.ResponseStatusException e) {
                    // 그사이 다른 요청이 지운 장소를 옮기려 한 경우(404)는 정상적인 거절
                }
                return null;
            });
        }
        for (Future<Void> f : pool.invokeAll(jobs)) f.get();
        pool.shutdown();

        // 검증: DB의 모든 장소가 연결 하나로 정확히 한 번씩 이어져 있어야 한다 (끊김·순환·중복 없음)
        Set<Integer> all = db.values().stream().filter(p -> p.getSelected_day() == DAY).map(Place::getPlace_id).collect(Collectors.toSet());
        List<Integer> chain = chainFromDb();
        assertEquals(all.size(), chain.size(), "연결을 따라가면 모든 장소를 정확히 한 번씩 만나야 한다");
        assertEquals(all, new HashSet<>(chain));
        assertEquals(1, db.values().stream().filter(p -> p.getSelected_day() == DAY && p.getNext_place_id() == null).count(),
                "마지막 장소(next=null)는 하나여야 한다");
    }

    // ───────── 도우미 ─────────

    private static void dbLatency() {
        try {
            Thread.sleep(1);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private List<Integer> seed(int n) {
        List<Integer> ids = new ArrayList<>();
        for (int i = 0; i < n; i++) ids.add(service.append(newPlace("장소" + i)).getPlace_id());
        return ids;
    }

    private static Place newPlace(String name) {
        Place p = new Place();
        p.setPlace_name(name);
        p.setTravelId(TRAVEL);
        p.setSelected_day(DAY);
        return p;
    }

    /** DB의 next_place_id를 시작점부터 따라간 순서 (순환이면 멈춘다) */
    private List<Integer> chainFromDb() {
        List<Place> day = db.values().stream().filter(p -> p.getSelected_day() == DAY).collect(Collectors.toList());
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
