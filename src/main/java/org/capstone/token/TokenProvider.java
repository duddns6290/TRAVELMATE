package org.capstone.token;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.HttpServletRequest;


import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.*;
import java.util.stream.Collectors;

/**
 * TokenProvider: JWT 생성, 파싱, 인증객체 추출, 유효성 검사 등의 토큰 관련 핵심 로직을 담당
 */

@Component
@RequiredArgsConstructor

public class TokenProvider {

    @Value("${jwt.secret}")
    private String secretKey;

    private Key key;
    private static final String KEY_ROLE = "role";
    private static final String KEY_TOKEN_TYPE = "tokenType";
    private static final String KEY_TRAVEL_ID = "travelId";
    private static final String TOKEN_TYPE_ACCESS = "access";
    private static final String TOKEN_TYPE_REFRESH = "refresh";
    private static final String DEFAULT_ROLE = "HOST";
    private static final long ACCESS_TOKEN_EXPIRE_TIME = 1000 * 60 * 30L; // 30분
    private static final long REFRESH_TOKEN_EXPIRE_TIME = 1000 * 60 * 60L * 24 * 7; // 7일
    private final long EXPIRATION_TIME = 1000 * 60 * 60;
    // secretKey를 Key 객체로 변환
    @PostConstruct
    protected void init() {
        this.key = Keys.hmacShaKeyFor(Base64.getEncoder().encodeToString(secretKey.getBytes()).getBytes());
    }

    // OAuth 로그인 사용자의 userId (이메일 앞부분)
    public String getUserId(Authentication authentication) {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        String email = oAuth2User.getAttribute("email");
        return email.split("@")[0];
    }

    // AccessToken 생성 (OAuth 로그인 직후)
    public String generateAccessToken(Authentication authentication) {
        return createAccessToken(getUserId(authentication));
    }

    // AccessToken 생성 - 여행이 정해지기 전의 로그인 토큰 (travelId 없음)
    public String createAccessToken(String userId) {
        Date now = new Date();

        return Jwts.builder()
                .setSubject(userId)       // 사용자 식별자 (userId)
                .claim(KEY_ROLE, DEFAULT_ROLE)           // 사용자 권한 정보 저장
                .claim(KEY_TOKEN_TYPE, TOKEN_TYPE_ACCESS) // ACCESS 토큰 표시 (getAuthentication()에서 확인)
                .setIssuedAt(now)                           // 발급시간
                .setExpiration(new Date(now.getTime() + ACCESS_TOKEN_EXPIRE_TIME)) // 만료시간
                .signWith(key, SignatureAlgorithm.HS256)    // 서명
                .compact();
    }

    // RefreshToken 생성 - Access Token 재발급에만 쓴다. 매번 다른 값이 되도록 jti(랜덤 id)를 넣는다.
    public String createRefreshToken(String userId) {
        Date now = new Date();

        return Jwts.builder()
                .setSubject(userId)
                .setId(UUID.randomUUID().toString())
                .claim(KEY_TOKEN_TYPE, TOKEN_TYPE_REFRESH)
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + REFRESH_TOKEN_EXPIRE_TIME))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public long getRefreshTokenExpireMillis() {
        return REFRESH_TOKEN_EXPIRE_TIME;
    }

    // RefreshToken 검증: 서명·만료·종류(refresh)가 모두 맞으면 userId, 아니면 null
    public String parseRefreshToken(String token) {
        try {
            Claims claims = Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
            return TOKEN_TYPE_REFRESH.equals(claims.get(KEY_TOKEN_TYPE)) ? claims.getSubject() : null;
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }


    // JWT에서 사용자 인증 객체 추출
    public Authentication getAuthentication(String token) {
        Claims claims = parseClaims(token);

        //인증 토큰이 아니면 예외 던지기 (tokenType이 없는 기존 토큰은 access로 간주)
        Object tokenType = claims.get(KEY_TOKEN_TYPE);
        if (tokenType != null && !TOKEN_TYPE_ACCESS.equals(tokenType.toString())) {
            throw new IllegalArgumentException("This token is not an access token.");
        }

        // role null 방지
        Object roleObj = claims.get(KEY_ROLE);
        String rawRole = roleObj != null ? roleObj.toString() : "ROLE_USER";

        List<SimpleGrantedAuthority> authorities = Arrays.stream(rawRole.split(","))
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());

        Object travelIdObj = claims.get(KEY_TRAVEL_ID);
        Integer travelId = travelIdObj != null ? Integer.valueOf(travelIdObj.toString()) : null;

        JwtUser principal = new JwtUser(claims.getSubject(), travelId, authorities);
        return new UsernamePasswordAuthenticationToken(principal, token, authorities);
    }


    // 토큰 유효성 검사
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    // 토큰에서 Claims 추출
    private Claims parseClaims(String token) {
        try {
            return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
        } catch (ExpiredJwtException e) {
            return e.getClaims();
        }
    }

    // HttpServletRequest 헤더에서 Authorization 토큰 추출
    public String resolveToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8));
    }

    public String createTravelToken(String userId, int travelId, String role) {
        Claims claims = Jwts.claims().setSubject(userId);
        claims.put(KEY_TRAVEL_ID, travelId);
        claims.put("role", role);
        claims.put(KEY_TOKEN_TYPE, TOKEN_TYPE_ACCESS);

        return Jwts.builder()
                .setClaims(claims)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }



    // 디코딩용 메서드도 필요
    public Claims getClaims(String token) {
        return Jwts.parser().setSigningKey(secretKey.getBytes()).parseClaimsJws(token).getBody();
    }

}

