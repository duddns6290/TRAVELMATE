package org.capstone.controller;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.TravelSwitchRequest;
import org.capstone.entity.userTravel.TravelUser;
import org.capstone.entity.userTravel.TravelUserId;
import org.capstone.repository.TravelUserRepository;
import org.capstone.service.RefreshTokenService;
import org.capstone.service.TravelUserService;
//import org.capstone.token.JwtTokenProvider;
import org.capstone.token.RefreshTokenCookie;
import org.capstone.token.TokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.CookieValue;
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
    private final RefreshTokenService refreshTokenService;

    @PostMapping("/switch-travel")
    public ResponseEntity<?> switchTravel(@RequestBody TravelSwitchRequest request, Authentication authentication) {
        // userId는 요청 body가 아니라 로그인 토큰에서 꺼낸다 (남의 userId로 토큰을 받아가지 못하게)
        String userId = authentication.getName();
        int travelId = request.getTravelId();

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

    // 재발급 요청: 보고 있던 여행이 있으면 travelId를 같이 보내 그 여행 토큰으로 다시 받는다
    public record RefreshRequest(Integer travelId) {}

    // Access Token 재발급. Refresh Token은 HttpOnly 쿠키로 받고, 쓸 때마다 새 것으로 바꿔준다(rotation).
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@CookieValue(name = RefreshTokenCookie.NAME, required = false) String refreshToken,
                                     @RequestBody(required = false) RefreshRequest request,
                                     HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        Optional<RefreshTokenService.Rotation> rotation =
                refreshToken == null ? Optional.empty() : refreshTokenService.rotate(refreshToken);
        if (rotation.isEmpty()) {
            RefreshTokenCookie.clear(httpRequest, httpResponse);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "다시 로그인해 주세요."));
        }

        String userId = rotation.get().userId();
        RefreshTokenCookie.set(httpRequest, httpResponse, rotation.get().refreshToken(),
                jwtTokenProvider.getRefreshTokenExpireMillis());

        // 여행 토큰이었으면 참여 여부를 다시 확인하고 같은 여행 토큰으로, 아니면(빠졌으면) 로그인 토큰으로
        Integer travelId = request != null ? request.travelId() : null;
        String token = Optional.ofNullable(travelId)
                .flatMap(id -> travelUserRepository.findById(new TravelUserId(id, userId)))
                .map(tu -> jwtTokenProvider.createTravelToken(userId, travelId, tu.getRole().name().toLowerCase()))
                .orElseGet(() -> jwtTokenProvider.createAccessToken(userId));

        return ResponseEntity.ok(Map.of("token", token));
    }

    // 로그아웃: 이 브라우저의 Refresh Token을 폐기하고 쿠키를 지운다
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = RefreshTokenCookie.NAME, required = false) String refreshToken,
                                       HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        if (refreshToken != null) {
            refreshTokenService.revoke(refreshToken);
        }
        RefreshTokenCookie.clear(httpRequest, httpResponse);
        return ResponseEntity.noContent().build();
    }
}
