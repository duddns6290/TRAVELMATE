package org.capstone.token;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;

import java.time.Duration;

/**
 * Refresh Token 쿠키. HttpOnly라 JS에서 읽을 수 없고(XSS로 못 훔침), /auth 경로 요청에만 실려 간다.
 */
public final class RefreshTokenCookie {

    public static final String NAME = "refreshToken";
    private static final String PATH = "/auth";

    private RefreshTokenCookie() {}

    public static void set(HttpServletRequest request, HttpServletResponse response, String token, long maxAgeMillis) {
        response.addHeader(HttpHeaders.SET_COOKIE, build(request, token, Duration.ofMillis(maxAgeMillis)).toString());
    }

    public static void clear(HttpServletRequest request, HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, build(request, "", Duration.ZERO).toString());
    }

    private static ResponseCookie build(HttpServletRequest request, String value, Duration maxAge) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(request.isSecure()) // 로컬(http)에서는 false, 배포(https)에서는 true
                .sameSite("Lax")
                .path(PATH)
                .maxAge(maxAge)
                .build();
    }
}
