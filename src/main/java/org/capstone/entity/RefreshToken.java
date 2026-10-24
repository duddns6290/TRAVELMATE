package org.capstone.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * 발급한 Refresh Token 목록. 원문이 아니라 SHA-256 해시만 저장한다 (DB가 새어도 토큰으로 쓸 수 없게).
 * 기기(브라우저)마다 한 줄씩 생기고, 재발급할 때마다 지우고 새로 넣는다(rotation).
 */
@Getter
@NoArgsConstructor
@Entity
@Table(name = "refresh_token", indexes = @Index(name = "idx_refresh_token_user", columnList = "userId"))
public class RefreshToken {

    @Id
    @Column(length = 64)
    private String tokenHash;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private Instant expiresAt;

    public RefreshToken(String tokenHash, String userId, Instant expiresAt) {
        this.tokenHash = tokenHash;
        this.userId = userId;
        this.expiresAt = expiresAt;
    }
}
