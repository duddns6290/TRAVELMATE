package org.capstone.controller;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.WebSocketMessage;
import org.capstone.entity.Role;
import org.capstone.entity.userTravel.TravelUser;
import org.capstone.entity.userTravel.TravelUserResponse;
import org.capstone.service.PlaceLockService;
import org.capstone.service.PlaceService;
import org.capstone.service.TravelUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/traveluser")
@RequiredArgsConstructor
public class TravelUserController {

    private final TravelUserService travelUserService;
    private final PlaceLockService placeLockService;
    private final PlaceService placeService;

    // 권한 조회
    @GetMapping("/role")
    public ResponseEntity<Role> getRole(
            @RequestParam int travelId,
            @RequestParam String userId
    ) {
        Role role = travelUserService.getRole(travelId, userId);
        return ResponseEntity.ok(role);
    }

    // 권한 수정
    @PutMapping("/role")
    public ResponseEntity<TravelUser> updateRole(
            @RequestParam int travelId,
            @RequestParam String userId,
            @RequestParam String roleKey
    ) {
        TravelUser updated = travelUserService.updateRole(travelId, userId, roleKey);
        return ResponseEntity.ok(updated);
    }

    // 권한 삭제
    @DeleteMapping("/role")
    public ResponseEntity<Void> deleteRole(
            @RequestParam int travelId,
            @RequestParam String userId
    ) {
        travelUserService.deleteRole(travelId, userId);
        return ResponseEntity.noContent().build();
    }

    // 새로운 TravelUser 추가
    @PostMapping
    public ResponseEntity<TravelUser> createTravelUser(
            @RequestParam int travelId,
            @RequestParam String userId,
            @RequestParam String roleKey
    ) {
        TravelUser created = travelUserService.createTravelUser(travelId, userId, roleKey);
        return ResponseEntity.ok(created);
    }
    //여행별 권한 유저들 조회
    @GetMapping("/{travelId}")
    public List<TravelUserResponse> getTravelUsers(@PathVariable int travelId) {
        return travelUserService.getUsersByTravelId(travelId);
    }


    @MessageMapping("/update/{travelId}")
    @SendTo("/topic/{travelId}")
    public WebSocketMessage handleWebSocketMessage(
            @DestinationVariable int travelId,
            WebSocketMessage message
    ) {
        message.setTimestamp(System.currentTimeMillis());

        switch (message.getType()) {
            case "PLACE_LOCK":
                placeLockService.tryLock(message.getPlaceId(), message.getUserId());
                break;
            case "PLACE_UNLOCK":
                placeLockService.unlock(message.getPlaceId(), message.getUserId());
                break;
            case "PLACE_UPDATE":
//                placeService.updatePlace(message.getPlaceId(), convertToPlace(message.getNewValue()));
                break;
            case "ROLE_UPDATE":
                travelUserService.updateRole(travelId, message.getUserId(), message.getNewValue().toString());
                break;
            default:
                throw new IllegalArgumentException("Unknown WebSocket message type: " + message.getType());
        }

        return message; // 그대로 브로드캐스트
    }


}
