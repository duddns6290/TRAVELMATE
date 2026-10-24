package org.capstone.service;

import org.capstone.entity.RefreshToken;
import org.capstone.repository.RefreshTokenRepository;
import org.capstone.token.TokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Refresh Token 재발급(rotation)과 재사용 감지 (DB 없이 메모리 저장소로).
 */
class RefreshTokenServiceTest {

    private final Map<String, RefreshToken> db = new ConcurrentHashMap<>();
    private TokenProvider tokenProvider;
    private RefreshTokenService service;

    @BeforeEach
    void setUp() {
        tokenProvider = new TokenProvider();
        ReflectionTestUtils.setField(tokenProvider, "secretKey", "test-secret-key-for-unit-tests-only-0123456789");
        ReflectionTestUtils.invokeMethod(tokenProvider, "init");

        RefreshTokenRepository repo = mock(RefreshTokenRepository.class);
        when(repo.save(any())).thenAnswer(inv -> {
            RefreshToken t = inv.getArgument(0);
            db.put(t.getTokenHash(), t);
            return t;
        });
        when(repo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(db.get(inv.<String>getArgument(0))));
        doAnswer(inv -> db.remove(inv.<RefreshToken>getArgument(0).getTokenHash())).when(repo).delete(any());
        doAnswer(inv -> db.remove(inv.<String>getArgument(0))).when(repo).deleteById(anyString());
        doAnswer(inv -> db.values().removeIf(t -> t.getUserId().equals(inv.getArgument(0)))).when(repo).deleteAllByUserId(anyString());

        service = new RefreshTokenService(repo, tokenProvider);
    }

    @Test
    void 원문이_아니라_해시만_저장한다() {
        String token = service.issue("alice");

        assertEquals(1, db.size());
        assertFalse(db.containsKey(token));
        assertEquals(64, db.keySet().iterator().next().length());
    }

    @Test
    void 재발급하면_새_토큰을_주고_쓴_토큰은_버린다() {
        String first = service.issue("alice");

        RefreshTokenService.Rotation rotation = service.rotate(first).orElseThrow();

        assertEquals("alice", rotation.userId());
        assertNotEquals(first, rotation.refreshToken());
        assertEquals(1, db.size());
    }

    @Test
    void 이미_쓴_토큰이_다시_오면_그_사용자_토큰을_모두_폐기한다() {
        String stolen = service.issue("alice");
        String newer = service.rotate(stolen).orElseThrow().refreshToken(); // 정상 사용자가 먼저 재발급
        service.issue("alice");  // 다른 기기
        service.issue("bob");

        assertTrue(service.rotate(stolen).isEmpty());   // 훔친 토큰 재사용
        assertTrue(service.rotate(newer).isEmpty());    // alice의 다른 토큰도 모두 무효
        assertEquals(1, db.size());                     // bob 것만 남음
    }

    @Test
    void 로그아웃한_토큰으로는_재발급할_수_없다() {
        String token = service.issue("alice");
        service.revoke(token);

        assertTrue(service.rotate(token).isEmpty());
    }

    @Test
    void Access_Token이나_위조_토큰으로는_재발급할_수_없다() {
        service.issue("alice");

        assertTrue(service.rotate(tokenProvider.createAccessToken("alice")).isEmpty());
        assertTrue(service.rotate("not-a-jwt").isEmpty());
        assertEquals(1, db.size()); // 서명이 틀린 토큰으로는 아무것도 지우지 않는다
    }

    @Test
    void Refresh_Token은_API_인증에_쓸_수_없다() {
        String refresh = service.issue("alice");

        assertThrows(IllegalArgumentException.class, () -> tokenProvider.getAuthentication(refresh));
    }
}
