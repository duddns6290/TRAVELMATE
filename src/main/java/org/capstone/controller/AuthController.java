package org.capstone.controller;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.TravelSwitchRequest;
import org.capstone.entity.userTravel.TravelUser;
import org.capstone.entity.userTravel.TravelUserId;
import org.capstone.repository.TravelUserRepository;
import org.capstone.service.TravelUserService;
//import org.capstone.token.JwtTokenProvider;
import org.capstone.token.TokenProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.Map;
import java.util.Optional;

@RestController
@RequiredArgsConstructor
@RequestMapping("/auth")
public class AuthController {

    private final TravelUserRepository travelUserRepository;
    private final TokenProvider jwtTokenProvider;
    private final TravelUserService travelUserService;

    @PostMapping("/switch-travel")
    public ResponseEntity<?> switchTravel(@RequestBody Map<String, Object> body) {
        String userId = (String) body.get("userId");
        Integer travelId = (Integer) body.get("travelId");

        // ✅ 유저가 여행에 포함되어 있는지 확인하고, 역할 조회
        TravelUserId id = new TravelUserId(travelId, userId);
        Optional<TravelUser> travelUserOpt = travelUserRepository.findById(id);

        if (travelUserOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "해당 여행에 접근 권한이 없습니다."));
        }

        String role = travelUserOpt.get().getRole().name().toLowerCase();

        String token = jwtTokenProvider.createTravelToken(userId, travelId, role);

        return ResponseEntity.ok(Map.of("token", token));
    }
}
