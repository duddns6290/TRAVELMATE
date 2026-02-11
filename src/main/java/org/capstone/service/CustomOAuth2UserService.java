package org.capstone.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.capstone.entity.OAuthAttributes;
import org.capstone.entity.UserProfile;
import org.capstone.entity.User;
import org.capstone.entity.userTravel.TravelUser;
import org.capstone.repository.TravelUserRepository;
import org.capstone.repository.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.ArrayList;


import java.util.Map;
import java.util.HashMap;

@Slf4j // 로그 사용
@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private final UserRepository userRepository;
    private final TravelUserRepository travelUserRepository;


    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {

        OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate = new DefaultOAuth2UserService();
        OAuth2User oAuth2User = delegate.loadUser(userRequest);

        String registrationId = userRequest.getClientRegistration().getRegistrationId(); // OAuth2 제공자 이름
        String userNameAttributeName = userRequest.getClientRegistration()
                .getProviderDetails()
                .getUserInfoEndpoint()
                .getUserNameAttributeName(); // OAuth2에서 제공하는 기본 키

        Map<String, Object> attributes = oAuth2User.getAttributes(); // 사용자의 정보

        // 제공자별 사용자 정보 변환
        UserProfile userProfile = OAuthAttributes.extract(registrationId, attributes);
        userProfile.setProvider(registrationId);

        // 사용자 정보 저장 또는 업데이트
        User user = updateOrSaveUser(userProfile);

        List<TravelUser> travelUsers = travelUserRepository.findAllByIdUserId(user.getUserid());
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();


        for (TravelUser travelUser : travelUsers) {
            if (travelUser.getRole() != null) {
                int travelId = travelUser.getId().getTravelId();
                String role = travelUser.getRole().name().toLowerCase(); // 예: "host"
                authorities.add(new SimpleGrantedAuthority("trip_" + travelId + "_" + role));
            }
        }

        Map<String, Object> customAttribute = getCustomAttribute(
                registrationId,
                userNameAttributeName,
                attributes,
                userProfile
        );

        return new DefaultOAuth2User(authorities, customAttribute, userNameAttributeName);
    }

    public Map<String, Object> getCustomAttribute(String registrationId,
                                                  String userNameAttributeName,
                                                  Map<String, Object> attributes,
                                                  UserProfile userProfile) {
        Map<String, Object> customAttribute = new HashMap<>();
        customAttribute.put(userNameAttributeName, attributes.get(userNameAttributeName));
        customAttribute.put("userid",userProfile.getUserid());          //아이디에는 이메일 앞부분
        customAttribute.put("provider", registrationId);
        customAttribute.put("name", userProfile.getUsername());
        customAttribute.put("email", userProfile.getEmail());

        log.info("✅ Custom Attribute 생성 완료: {}", customAttribute);
        return customAttribute;
    }

    public User updateOrSaveUser(UserProfile userProfile) {
        User user = userRepository
                .findUserByEmailAndProvider(userProfile.getEmail(), userProfile.getProvider())
                .map(value -> {
                    return value.update(userProfile.getUserid(), userProfile.getUsername(), userProfile.getEmail());
                })
                .orElseGet(() -> {
                    return userProfile.toEntity();
                });

        return userRepository.save(user);
    }
}
