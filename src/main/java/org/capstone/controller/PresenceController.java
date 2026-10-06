package org.capstone.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * 같은 여행을 보고 있는 사용자들의 실시간 커서(지도 위 좌표, 타임라인에서 마우스를 올린 장소)를 전달만 한다.
 * 편집 메시지(/topic/{travelId})와 섞이지 않도록 별도 토픽을 쓰고, 아무것도 저장하지 않는다.
 * payload 예: { userId, lat, lng, hoverPlaceId, leave }
 */
@Controller
public class PresenceController {

    @MessageMapping("/cursor/{travelId}")
    @SendTo("/topic/{travelId}/cursor")
    public Map<String, Object> relayCursor(@DestinationVariable int travelId, Map<String, Object> payload) {
        return payload;
    }
}
