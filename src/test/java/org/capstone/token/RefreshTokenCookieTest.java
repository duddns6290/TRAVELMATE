package org.capstone.token;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Refresh Token 쿠키 속성: JS에서 못 읽고(HttpOnly), /auth 요청에만 실리고, https에서만 Secure.
 */
class RefreshTokenCookieTest {

    @Test
    void 쿠키는_HttpOnly이고_auth_경로에만_실린다() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        RefreshTokenCookie.set(new MockHttpServletRequest(), response, "tok", 60_000);

        String cookie = response.getHeader(HttpHeaders.SET_COOKIE);
        assertTrue(cookie.startsWith("refreshToken=tok"));
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("Path=/auth"));
        assertTrue(cookie.contains("SameSite=Lax"));
        assertTrue(cookie.contains("Max-Age=60"));
        assertFalse(cookie.contains("Secure")); // 로컬 http
    }

    @Test
    void https_요청이면_Secure를_붙인다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSecure(true);
        MockHttpServletResponse response = new MockHttpServletResponse();

        RefreshTokenCookie.set(request, response, "tok", 60_000);

        assertTrue(response.getHeader(HttpHeaders.SET_COOKIE).contains("Secure"));
    }

    @Test
    void clear는_같은_경로의_쿠키를_바로_만료시킨다() {
        MockHttpServletResponse response = new MockHttpServletResponse();

        RefreshTokenCookie.clear(new MockHttpServletRequest(), response);

        String cookie = response.getHeader(HttpHeaders.SET_COOKIE);
        assertTrue(cookie.startsWith("refreshToken=;"));
        assertTrue(cookie.contains("Max-Age=0"));
        assertTrue(cookie.contains("Path=/auth")); // 경로가 다르면 브라우저가 지우지 않는다
    }
}
