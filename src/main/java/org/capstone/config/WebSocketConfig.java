package org.capstone.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");  // 클라이언트 수신
        config.setApplicationDestinationPrefixes("/app");  // 클라이언트 송신
        // 브로커가 각 구독자에게 보내는 메시지를 보낸 순서대로 전달 (기본은 스레드 풀이라 순서가 섞일 수 있다)
        config.setPreservePublishOrder(true);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")  // 연결 URL
                .setAllowedOriginPatterns("*")
                .withSockJS();       // SockJS 지원 (호환성 보장)
        // 한 사용자가 보낸 메시지를 받은 순서대로 처리 (PLACE_LOCK → PLACE_UNLOCK이 뒤바뀌지 않게)
        registry.setPreserveReceiveOrder(true);
    }
}
