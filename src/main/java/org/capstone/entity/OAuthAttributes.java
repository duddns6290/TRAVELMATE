package org.capstone.entity;

import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;

public enum OAuthAttributes {

    NAVER("naver", (attribute) -> {
        UserProfile userProfile = new UserProfile();

        Map<String, String> responseValue = (Map)attribute.get("response");

        userProfile.setUserid(getLoginId(responseValue.get("email")));
        userProfile.setUsername(responseValue.get("name"));
        userProfile.setEmail(responseValue.get("email"));

        return userProfile;
    }),

    KAKAO("kakao", (attribute) -> {

        Map<String, Object> account = (Map)attribute.get("kakao_account");
        Map<String, String> profile = (Map)account.get("profile");

        UserProfile userProfile = new UserProfile();

        userProfile.setUserid(getLoginId((String)account.get("email")));
        userProfile.setUsername(profile.get("nickname"));
        userProfile.setEmail((String)account.get("email"));


        return userProfile;
    });

    private final String registrationId; // 로그인한 서비스 (ex)google, naver..
    private final Function<Map<String, Object>, UserProfile> of; // 로그인한 사용자의 정보를 통하여 UserProfile을 가져옴

    OAuthAttributes(String registrationId, Function<Map<String, Object>, UserProfile> of) {
        this.registrationId = registrationId; //로그인한 서비스
        this.of = of;
    }

    public static UserProfile extract(String registrationId, Map<String, Object> attributes) {
        return Arrays.stream(values())
                .filter(value -> registrationId.equals(value.registrationId))
                .findFirst()
                .orElseThrow(IllegalArgumentException::new)
                .of.apply(attributes);
    }

    // oauth인증 받을때 아이디는 이메일 앞부분!
    public static String getLoginId(String email) {
        if (email == null || !email.contains("@")) {
            throw new IllegalArgumentException("Invalid email format");
        }
        return email.split("@")[0];
    }
}
