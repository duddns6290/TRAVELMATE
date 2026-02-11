package org.capstone.entity;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;

public class CustomUserDetails implements UserDetails {
    private final User user;

    public CustomUserDetails(User user) {
        this.user = user;
    }

    public String getUserid() {
        return user.getUserid(); // 이걸 토큰에 넣자!
    }

    @Override
    public String getUsername() {
        return user.getEmail(); // 로그인에 사용하는 고유 식별자
    }

    @Override
    public String getPassword() {
        return user.getUserpw(); // 일반 로그인용 비번
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return null; // 필요 시 구현
    }

    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return true; }
}
