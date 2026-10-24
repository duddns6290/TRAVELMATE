package org.capstone.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.capstone.entity.RefreshToken;
import org.capstone.repository.RefreshTokenRepository;
import org.capstone.token.TokenProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Refresh Token 발급·재발급(rotation)·폐기.
 *
 * 재발급할 때마다 쓴 토큰은 지우고 새 토큰을 준다. 그래서 한 번 쓴 토큰이 다시 들어오면
 * (서명은 맞는데 저장소에 없으면) 누군가 훔친 토큰을 쓰는 것으로 보고 그 사용자의 토큰을 모두 폐기한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final TokenProvider tokenProvider;

    /** 재발급 결과: 누구의 토큰인지와 새 Refresh Token 원문 */
    public record Rotation(String userId, String refreshToken) {}

    @Transactional
    public String issue(String userId) {
        refreshTokenRepository.deleteExpiredByUserId(userId, Instant.now()); // 만료된 줄 정리
        String token = tokenProvider.createRefreshToken(userId);
        Instant expiresAt = Instant.now().plusMillis(tokenProvider.getRefreshTokenExpireMillis());
        refreshTokenRepository.save(new RefreshToken(hash(token), userId, expiresAt));
        return token;
    }

    // 유효하면 쓴 토큰을 지우고 새 토큰을 발급한다. 쓸 수 없는 토큰이면 empty.
    @Transactional
    public Optional<Rotation> rotate(String token) {
        String userId = tokenProvider.parseRefreshToken(token);
        if (userId == null) return Optional.empty(); // 위조·만료·종류가 다른 토큰

        Optional<RefreshToken> saved = refreshTokenRepository.findById(hash(token));
        if (saved.isEmpty() || !saved.get().getUserId().equals(userId)) {
            log.warn("이미 사용됐거나 폐기된 Refresh Token 재사용 감지 → {}의 토큰 전체 폐기", userId);
            refreshTokenRepository.deleteAllByUserId(userId);
            return Optional.empty();
        }

        refreshTokenRepository.delete(saved.get());
        return Optional.of(new Rotation(userId, issue(userId)));
    }

    // 로그아웃: 이 브라우저의 토큰만 지운다
    @Transactional
    public void revoke(String token) {
        refreshTokenRepository.deleteById(hash(token));
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
