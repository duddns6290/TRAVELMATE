package org.capstone.entity;

import lombok.Getter;

import lombok.Setter;

// 네이버, 카카오의 응답을 하나의 통일된 형태로 변환
@Getter
@Setter
public class UserProfile {
    private String username;
    private String provider;
    private String email;
    private String userid;


    // User 엔티티 생성 -> 처음 가입할 때
    public User toEntity() {
        return User.builder()
                .userid(this.userid)
                .name(this.username)
                .email(this.email)
                .provider(this.provider)
                .build();
    }
}
