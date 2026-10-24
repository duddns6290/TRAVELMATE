package org.capstone.token;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.Role;
import org.capstone.entity.userTravel.TravelUser;
import org.capstone.entity.userTravel.TravelUserId;
import org.capstone.repository.PlaceRepository;
import org.capstone.repository.TempPlaceRepository;
import org.capstone.repository.TravelUserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * 여행별 접근 권한 검사. 컨트롤러에서 @PreAuthorize("@travelAccess.xxx(authentication, ...)")로 쓴다.
 *
 * - isMember / isHost: 로그인 토큰만 있어도 되는 마이페이지 기능 (여행 수정·삭제, 공유 설정, PDF)
 * - hasTravelToken: 여행에 들어가서 쓰는 기능. /auth/switch-travel로 받은 그 여행의 토큰이어야 한다.
 *
 * 토큰이 유효한 동안 여행에서 빠질 수도 있으니 참여 여부는 매번 DB로 다시 확인한다.
 */
@Component("travelAccess")
@RequiredArgsConstructor
public class TravelAccessChecker {

    private final TravelUserRepository travelUserRepository;
    private final PlaceRepository placeRepository;
    private final TempPlaceRepository tempPlaceRepository;

    public boolean isMember(Authentication auth, Long travelId) {
        return findTravelUser(auth, travelId).isPresent();
    }

    public boolean isHost(Authentication auth, Long travelId) {
        return findTravelUser(auth, travelId)
                .map(tu -> tu.getRole() == Role.HOST)
                .orElse(false);
    }

    public boolean hasTravelToken(Authentication auth, Long travelId) {
        if (travelId == null || !(auth.getPrincipal() instanceof JwtUser user)) return false;
        return user.getTravelId() != null
                && user.getTravelId().longValue() == travelId
                && isMember(auth, travelId);
    }

    // 장소 id로 들어오는 요청: 그 장소가 속한 여행의 토큰인지 확인한다. 없는 장소면 컨트롤러가 처리하도록 통과시킨다.
    public boolean canAccessPlace(Authentication auth, Integer placeId) {
        return placeRepository.findById(placeId)
                .map(p -> hasTravelToken(auth, p.getTravelId()))
                .orElse(true);
    }

    public boolean canAccessTempPlace(Authentication auth, Long tempPlaceId) {
        return tempPlaceRepository.findById(tempPlaceId)
                .map(t -> hasTravelToken(auth, t.getTravelId()))
                .orElse(true);
    }

    private Optional<TravelUser> findTravelUser(Authentication auth, Long travelId) {
        if (auth == null || travelId == null) return Optional.empty();
        return travelUserRepository.findById(new TravelUserId(travelId.intValue(), auth.getName()));
    }
}
