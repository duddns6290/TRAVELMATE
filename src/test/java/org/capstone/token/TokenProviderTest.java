package org.capstone.token;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;

import java.security.Key;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 토큰 종류(로그인·여행·Refresh)별 발급과 검증.
 */
class TokenProviderTest {

    private TokenProvider tokenProvider;

    @BeforeEach
    void setUp() {
        tokenProvider = newProvider("test-secret-key-for-unit-tests-only-0123456789");
    }

    private static TokenProvider newProvider(String secret) {
        TokenProvider provider = new TokenProvider();
        ReflectionTestUtils.setField(provider, "secretKey", secret);
        ReflectionTestUtils.invokeMethod(provider, "init");
        return provider;
    }

    @Test
    void 로그인_토큰에는_travelId가_없다() {
        Authentication auth = tokenProvider.getAuthentication(tokenProvider.createAccessToken("alice"));

        assertEquals("alice", auth.getName());
        assertNull(((JwtUser) auth.getPrincipal()).getTravelId());
    }

    @Test
    void 여행_토큰에는_travelId와_역할이_들어간다() {
        Authentication auth = tokenProvider.getAuthentication(tokenProvider.createTravelToken("alice", 7, "guest_write"));

        assertEquals("alice", auth.getName());
        assertEquals(7, ((JwtUser) auth.getPrincipal()).getTravelId());
        assertTrue(auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("guest_write")));
    }

    @Test
    void Refresh_Token은_parseRefreshToken으로만_읽힌다() {
        String refresh = tokenProvider.createRefreshToken("alice");

        assertEquals("alice", tokenProvider.parseRefreshToken(refresh));
        assertThrows(IllegalArgumentException.class, () -> tokenProvider.getAuthentication(refresh));
    }

    @Test
    void Access_Token이나_여행_토큰은_Refresh_Token으로_쓸_수_없다() {
        assertNull(tokenProvider.parseRefreshToken(tokenProvider.createAccessToken("alice")));
        assertNull(tokenProvider.parseRefreshToken(tokenProvider.createTravelToken("alice", 7, "host")));
        assertNull(tokenProvider.parseRefreshToken("not-a-jwt"));
        assertNull(tokenProvider.parseRefreshToken(null));
    }

    @Test
    void Refresh_Token은_발급할_때마다_다르다() {
        assertNotEquals(tokenProvider.createRefreshToken("alice"), tokenProvider.createRefreshToken("alice"));
    }

    @Test
    void 다른_키로_서명된_토큰은_거부한다() {
        TokenProvider attacker = newProvider("another-secret-key-that-is-long-enough-0123456789");

        assertFalse(tokenProvider.validateToken(attacker.createAccessToken("alice")));
        assertNull(tokenProvider.parseRefreshToken(attacker.createRefreshToken("alice")));
    }

    @Test
    void 만료된_토큰은_거부한다() {
        Key key = (Key) ReflectionTestUtils.getField(tokenProvider, "key");
        Date past = new Date(System.currentTimeMillis() - 1000);
        String expiredAccess = Jwts.builder().setSubject("alice").claim("tokenType", "access")
                .setExpiration(past).signWith(key, SignatureAlgorithm.HS256).compact();
        String expiredRefresh = Jwts.builder().setSubject("alice").claim("tokenType", "refresh")
                .setExpiration(past).signWith(key, SignatureAlgorithm.HS256).compact();

        assertFalse(tokenProvider.validateToken(expiredAccess));
        assertNull(tokenProvider.parseRefreshToken(expiredRefresh));
    }

    @Test
    void tokenType이_없는_예전_토큰은_access로_본다() {
        Key key = (Key) ReflectionTestUtils.getField(tokenProvider, "key");
        String legacy = Jwts.builder().setSubject("alice").claim("role", "HOST")
                .setExpiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(key, SignatureAlgorithm.HS256).compact();

        assertEquals("alice", tokenProvider.getAuthentication(legacy).getName());
    }

    @Test
    void Authorization_헤더에서_Bearer_토큰만_꺼낸다() {
        MockHttpServletRequest bearer = new MockHttpServletRequest();
        bearer.addHeader("Authorization", "Bearer abc.def.ghi");
        MockHttpServletRequest basic = new MockHttpServletRequest();
        basic.addHeader("Authorization", "Basic dXNlcjpwdw==");

        assertEquals("abc.def.ghi", tokenProvider.resolveToken(bearer));
        assertNull(tokenProvider.resolveToken(basic));
        assertNull(tokenProvider.resolveToken(new MockHttpServletRequest()));
    }

    @Test
    void Refresh_Token_만료는_7일이다() {
        assertEquals(7L * 24 * 60 * 60 * 1000, tokenProvider.getRefreshTokenExpireMillis());
    }
}
