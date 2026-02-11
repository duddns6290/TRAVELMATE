package org.capstone.service;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.Role;
import org.capstone.entity.userTravel.TravelUser;
import org.capstone.entity.userTravel.TravelUserId;
import org.capstone.entity.userTravel.TravelUserResponse;
import org.capstone.repository.TravelRepository;
import org.capstone.repository.TravelUserRepository;
import org.capstone.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TravelUserService {

    private final TravelUserRepository travelUserRepository;
    private final UserRepository userRepository;

    // 권한 조회
    public Role getRole(int travelId, String userId) {
        TravelUserId id = new TravelUserId(travelId, userId);
        return travelUserRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없음"))
                .getRole();
    }

    // 권한 수정
    public TravelUser updateRole(int travelId, String userId, String roleKey) {
        TravelUserId id = new TravelUserId(travelId, userId);
        TravelUser travelUser = travelUserRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없음"));

        Role newRole = getRoleByKey(roleKey);
        travelUser.setRole(newRole);
        return travelUserRepository.save(travelUser);
    }

    // 권한 삭제
    public void deleteRole(int travelId, String userId) {
        TravelUserId id = new TravelUserId(travelId, userId);
        TravelUser travelUser = travelUserRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없음"));

        travelUser.setRole(null);
        travelUserRepository.save(travelUser);
    }

    // 새로운 TravelUser 추가 => 친구 초대
    public TravelUser createTravelUser(int travelId, String userId, String roleKey) {
        TravelUserId id = new TravelUserId(travelId, userId);

        if (travelUserRepository.existsById(id)) {
            throw new RuntimeException("사용자가 이미 추가되어 있음");
        }

        TravelUser travelUser = new TravelUser();
        travelUser.setId(id);
        travelUser.setRole(getRoleByKey(roleKey));

        return travelUserRepository.save(travelUser);
    }

    // private 헬퍼 메소드
    private Role getRoleByKey(String key) {
        return Arrays.stream(Role.values())
                .filter(role -> role.getKey().equalsIgnoreCase(key))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Invalid role key: " + key));
    }

    public List<TravelUserResponse> getUsersByTravelId(int travelId) {
        List<TravelUser> travelUsers = travelUserRepository.findByIdTravelId(travelId);

        return travelUsers.stream().map(tu -> {
            var user = userRepository.findById(tu.getId().getUserId()).orElse(null);
            if (user != null) {
                return new TravelUserResponse(
                        user.getUserid(),
                        user.getName(),
                        user.getEmail(),
                        tu.getRole().name()
                );
            }
            return null;
        }).filter(res -> res != null).collect(Collectors.toList());
    }

    public boolean isUserInTravel(String userId, Integer travelId) {
        return travelUserRepository.existsByIdUserIdAndIdTravelId(userId, travelId);
    }
}

