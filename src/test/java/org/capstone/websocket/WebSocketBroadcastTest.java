package org.capstone.websocket;

import org.capstone.config.WebSocketConfig;
import org.capstone.controller.TravelUserController;
import org.capstone.entity.WebSocketMessage;
import org.capstone.service.PlaceLockService;
import org.capstone.service.PlaceService;
import org.capstone.service.TravelUserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.http.HttpMessageConvertersAutoConfiguration;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.ServletWebServerFactoryAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration;
import org.springframework.boot.autoconfigure.websocket.servlet.WebSocketMessagingAutoConfiguration;
import org.springframework.boot.autoconfigure.websocket.servlet.WebSocketServletAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.springframework.web.socket.sockjs.client.SockJsClient;
import org.springframework.web.socket.sockjs.client.WebSocketTransport;

import java.lang.reflect.Type;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 실시간 협업 브로드캐스트 테스트 (/app/update/{travelId} → /topic/{travelId}).
 *
 * - 같은 여행(topic)을 구독한 클라이언트 10개가 이벤트 100건을 나눠 보낸다 → 기대 수신 1000건
 * - 메시지마다 고유 id와 보낸 시각을 넣어 지연시간(p50/p95), 수신율, 데이터 정합성(누락·중복·내용 변조)을 잰다
 * - 모든 클라이언트가 실제로 수신하는 것을 확인한(워밍업) 뒤에 측정을 시작한다
 *
 * 실제 서버(내장 Tomcat, 랜덤 포트)에 SockJS + STOMP로 접속한다. DB는 쓰지 않는다
 * (PLACE_ADD는 서버가 그대로 브로드캐스트만 하는 이벤트).
 */
@Tag("websocket")
@SpringBootTest(classes = WebSocketBroadcastTest.Config.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class WebSocketBroadcastTest {

    private static final int CLIENTS = 10;
    private static final int EVENTS = 100;
    private static final int EXPECTED = CLIENTS * EVENTS;
    private static final int TRAVEL_ID = 7;
    private static final String TOPIC = "/topic/" + TRAVEL_ID;
    private static final String SEND = "/app/update/" + TRAVEL_ID;
    private static final long P95_LIMIT_MS = 1000; // 로컬 기준 넉넉한 상한 (실패 시 성능 저하 신호)

    @Configuration
    @Import({WebSocketConfig.class, TravelUserController.class})
    @ImportAutoConfiguration({ServletWebServerFactoryAutoConfiguration.class, DispatcherServletAutoConfiguration.class,
            WebMvcAutoConfiguration.class, JacksonAutoConfiguration.class, HttpMessageConvertersAutoConfiguration.class,
            WebSocketServletAutoConfiguration.class, WebSocketMessagingAutoConfiguration.class})
    static class Config {}

    @LocalServerPort int port;

    @MockitoBean TravelUserService travelUserService;
    @MockitoBean PlaceLockService placeLockService;
    @MockitoBean PlaceService placeService;

    /** 보낸 메시지 원본: 정합성 비교용 */
    private record Sent(String msgId, String sender, int placeId, int seq, long sentAtNanos) {}

    /** 클라이언트 한 개의 수신 기록 */
    private static class Receiver {
        final String userId;
        final Map<String, AtomicInteger> counts = new ConcurrentHashMap<>();
        final Map<String, Integer> lastSeqBySender = new ConcurrentHashMap<>();
        final CountDownLatch warmedUp = new CountDownLatch(1);
        StompSession session;

        Receiver(String userId) { this.userId = userId; }
    }

    private final List<WebSocketStompClient> stompClients = new ArrayList<>();
    private final List<Receiver> receivers = new ArrayList<>();
    private final Map<String, Sent> sent = new ConcurrentHashMap<>();
    private final Queue<Long> latenciesMicros = new ConcurrentLinkedQueue<>();
    private final AtomicInteger corrupted = new AtomicInteger();
    private final AtomicInteger unknown = new AtomicInteger();
    private final AtomicInteger outOfOrder = new AtomicInteger();
    private final CountDownLatch allReceived = new CountDownLatch(EXPECTED);

    @AfterEach
    void tearDown() {
        receivers.forEach(r -> { if (r.session != null && r.session.isConnected()) r.session.disconnect(); });
        stompClients.forEach(WebSocketStompClient::stop);
    }

    @Test
    void 클라이언트_10개가_이벤트_100건을_모두_정확히_받는다() throws Exception {
        // 1. 연결 + 구독
        for (int i = 0; i < CLIENTS; i++) {
            Receiver r = new Receiver("user" + i);
            r.session = connect();
            r.session.subscribe(TOPIC, handler(r));
            receivers.add(r);
        }

        // 2. 워밍업: 모든 클라이언트가 실제로 받는 것을 확인할 때까지 신호를 보낸다 (구독 등록 완료 보장)
        warmUp();

        // 3. 측정: 클라이언트들이 동시에 이벤트를 나눠 보낸다 (협업 중 여러 명이 동시에 편집하는 상황)
        long start = System.nanoTime();
        ExecutorService pool = Executors.newFixedThreadPool(CLIENTS);
        AtomicInteger next = new AtomicInteger();
        for (Receiver sender : receivers) {
            pool.submit(() -> {
                int seq = 0;
                int n;
                while ((n = next.getAndIncrement()) < EVENTS) {
                    send(sender, n, seq++);
                }
            });
        }
        pool.shutdown();
        assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS), "전송이 끝나지 않음");

        boolean complete = allReceived.await(10, TimeUnit.SECONDS);
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;
        Thread.sleep(300); // 늦게 오는 중복 수신까지 잡기 위해 잠시 더 기다린다

        // 4. 집계
        int received = 0, duplicated = 0, missing = 0;
        for (Receiver r : receivers) {
            for (String msgId : sent.keySet()) {
                int c = r.counts.getOrDefault(msgId, new AtomicInteger()).get();
                if (c == 0) missing++;
                received += Math.min(c, 1);
                duplicated += Math.max(c - 1, 0);
            }
        }
        List<Long> sorted = latenciesMicros.stream().sorted().toList();
        double p50 = percentileMs(sorted, 0.50);
        double p95 = percentileMs(sorted, 0.95);
        double max = sorted.isEmpty() ? 0 : sorted.get(sorted.size() - 1) / 1000.0;

        System.out.printf("""

                ===== WebSocket 브로드캐스트 테스트 =====
                클라이언트 %d / 전송 %d건 / 기대 수신 %d건 / 소요 %dms
                수신율     %d / %d (%.1f%%)
                정합성     누락 %d · 중복 %d · 내용 불일치 %d · 모르는 메시지 %d
                순서       같은 보낸 사람 기준 순서 역전 %d건
                지연시간   p50 %.2fms · p95 %.2fms · max %.2fms
                =========================================
                """,
                CLIENTS, EVENTS, EXPECTED, elapsedMs,
                received, EXPECTED, received * 100.0 / EXPECTED,
                missing, duplicated, corrupted.get(), unknown.get(),
                outOfOrder.get(),
                p50, p95, max);

        assertEquals(EVENTS, sent.size());
        assertTrue(complete, "시간 안에 다 받지 못함");
        assertEquals(EXPECTED, received, "수신율 100%가 아님");
        assertEquals(0, missing, "누락");
        assertEquals(0, duplicated, "중복 수신");
        assertEquals(0, corrupted.get(), "내용이 바뀐 메시지");
        assertEquals(0, unknown.get(), "보내지 않은 메시지 수신");
        assertTrue(p95 < P95_LIMIT_MS, "p95 지연이 " + P95_LIMIT_MS + "ms를 넘음: " + p95);
        // 같은 사람이 보낸 메시지는 보낸 순서대로 도착해야 한다 (WebSocketConfig의 순서 보존 설정)
        // 서로 다른 사람의 메시지끼리는 순서를 보장하지 않는다
        assertEquals(0, outOfOrder.get(), "같은 보낸 사람의 메시지 순서가 뒤바뀜");
    }

    private StompSession connect() throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(
                new SockJsClient(List.of(new WebSocketTransport(new StandardWebSocketClient()))));
        client.setMessageConverter(new MappingJackson2MessageConverter());
        stompClients.add(client);
        return client.connectAsync("ws://localhost:" + port + "/ws", new StompSessionHandlerAdapter() {})
                .get(5, TimeUnit.SECONDS);
    }

    private void warmUp() throws Exception {
        long deadline = System.currentTimeMillis() + 5000;
        while (receivers.stream().anyMatch(r -> r.warmedUp.getCount() > 0)) {
            assertTrue(System.currentTimeMillis() < deadline, "워밍업 실패: 구독이 등록되지 않음");
            WebSocketMessage ping = message(receivers.get(0).userId, -1, Map.of("warmup", true));
            receivers.get(0).session.send(SEND, ping);
            Thread.sleep(100);
        }
    }

    private void send(Receiver sender, int n, int seq) {
        String msgId = UUID.randomUUID().toString();
        long sentAt = System.nanoTime();
        sent.put(msgId, new Sent(msgId, sender.userId, n, seq, sentAt));
        sender.session.send(SEND, message(sender.userId, n, Map.of(
                "msgId", msgId, "seq", seq, "sentAt", sentAt)));
    }

    private static WebSocketMessage message(String userId, int placeId, Map<String, Object> payload) {
        WebSocketMessage m = new WebSocketMessage();
        m.setType("PLACE_ADD");
        m.setTravelId(TRAVEL_ID);
        m.setPlaceId(placeId);
        m.setUserId(userId);
        m.setNewValue(payload);
        return m;
    }

    private StompFrameHandler handler(Receiver r) {
        return new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return WebSocketMessage.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                long now = System.nanoTime();
                WebSocketMessage m = (WebSocketMessage) payload;
                Map<?, ?> value = (Map<?, ?>) m.getNewValue();

                if (Boolean.TRUE.equals(value.get("warmup"))) {
                    r.warmedUp.countDown();
                    return;
                }

                Sent original = sent.get((String) value.get("msgId"));
                if (original == null) {
                    unknown.incrementAndGet();
                    return;
                }

                int seq = ((Number) value.get("seq")).intValue();
                long sentAt = ((Number) value.get("sentAt")).longValue();
                boolean intact = "PLACE_ADD".equals(m.getType())
                        && m.getTravelId() == TRAVEL_ID
                        && m.getPlaceId() == original.placeId()
                        && original.sender().equals(m.getUserId())
                        && seq == original.seq()
                        && sentAt == original.sentAtNanos()
                        && m.getTimestamp() > 0; // 서버가 찍은 시각
                if (!intact) corrupted.incrementAndGet();

                Integer last = r.lastSeqBySender.put(original.sender(), seq);
                if (last != null && seq < last) outOfOrder.incrementAndGet();

                if (r.counts.computeIfAbsent(original.msgId(), k -> new AtomicInteger()).incrementAndGet() == 1) {
                    latenciesMicros.add((now - original.sentAtNanos()) / 1000);
                    allReceived.countDown();
                }
            }
        };
    }

    private static double percentileMs(List<Long> sortedMicros, double p) {
        if (sortedMicros.isEmpty()) return 0;
        int idx = (int) Math.ceil(p * sortedMicros.size()) - 1;
        return sortedMicros.get(Math.max(idx, 0)) / 1000.0;
    }
}
