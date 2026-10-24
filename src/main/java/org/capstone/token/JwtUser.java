package org.capstone.token;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.Collection;

/**
 * JWT에서 꺼낸 인증 사용자. 여행 전용 토큰이면 travelId를 함께 들고 있다 (로그인 토큰이면 null).
 */
@Getter
public class JwtUser extends User {

    private final Integer travelId;

    public JwtUser(String userId, Integer travelId, Collection<? extends GrantedAuthority> authorities) {
        super(userId, "", authorities);
        this.travelId = travelId;
    }
}
