package org.capstone.token;

import org.capstone.entity.Place;
import org.capstone.entity.Role;
import org.capstone.entity.userTravel.TravelUser;
import org.capstone.entity.userTravel.TravelUserId;
import org.capstone.repository.PlaceRepository;
import org.capstone.repository.TempPlaceRepository;
import org.capstone.repository.TravelUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 여행별 접근 검사 (DB 없이).
 * 핵심: /auth/switch-travel로 받은 그 여행의 토큰이면서, 지금도 그 여행의 참여자여야 접근할 수 있다.
 */
class TravelAccessCheckerTest {

    private static final int TRAVEL = 7;
    private static final int OTHER_TRAVEL = 8;

    private TokenProvider tokenProvider;
    private TravelUserRepository travelUserRepo;
    private PlaceRepository placeRepo;
    private TravelAccessChecker checker;

    @BeforeEach
    void setUp() {
        tokenProvider = new TokenProvider();
        ReflectionTestUtils.setField(tokenProvider, "secretKey", "test-secret-key-for-unit-tests-only-0123456789");
        ReflectionTestUtils.invokeMethod(tokenProvider, "init");

        travelUserRepo = mock(TravelUserRepository.class);
        placeRepo = mock(PlaceRepository.class);
        when(travelUserRepo.findById(any())).thenReturn(Optional.empty());
        checker = new TravelAccessChecker(travelUserRepo, placeRepo, mock(TempPlaceRepository.class));
    }

    private void join(String userId, int travelId, Role role) {
        TravelUser tu = new TravelUser();
        tu.setId(new TravelUserId(travelId, userId));
        tu.setRole(role);
        when(travelUserRepo.findById(new TravelUserId(travelId, userId))).thenReturn(Optional.of(tu));
    }

    private Authentication travelToken(String userId, int travelId) {
        String token = tokenProvider.createTravelToken(userId, travelId, "host");
        return tokenProvider.getAuthentication(token);
    }

    @Test
    void 여행_토큰에서_userId와_travelId를_꺼낸다() {
        Authentication auth = travelToken("alice", TRAVEL);

        assertEquals("alice", auth.getName());
        assertEquals(TRAVEL, ((JwtUser) auth.getPrincipal()).getTravelId());
    }

    @Test
    void 그_여행의_토큰이고_참여자면_통과() {
        join("alice", TRAVEL, Role.GUEST_WRITE);

        assertTrue(checker.hasTravelToken(travelToken("alice", TRAVEL), (long) TRAVEL));
    }

    @Test
    void 다른_여행의_토큰이면_거부() {
        join("alice", TRAVEL, Role.HOST);
        join("alice", OTHER_TRAVEL, Role.HOST);

        assertFalse(checker.hasTravelToken(travelToken("alice", TRAVEL), (long) OTHER_TRAVEL));
    }

    @Test
    void 토큰을_받은_뒤_여행에서_빠졌으면_거부() {
        Authentication auth = travelToken("alice", TRAVEL); // 참여 기록 없음

        assertFalse(checker.hasTravelToken(auth, (long) TRAVEL));
    }

    @Test
    void 장소_id로_들어오면_그_장소의_여행으로_검사한다() {
        join("alice", TRAVEL, Role.HOST);
        Place mine = new Place();
        mine.setTravelId((long) TRAVEL);
        Place others = new Place();
        others.setTravelId((long) OTHER_TRAVEL);
        when(placeRepo.findById(1)).thenReturn(Optional.of(mine));
        when(placeRepo.findById(2)).thenReturn(Optional.of(others));

        Authentication auth = travelToken("alice", TRAVEL);
        assertTrue(checker.canAccessPlace(auth, 1));
        assertFalse(checker.canAccessPlace(auth, 2));
    }

    @Test
    void 호스트만_isHost() {
        join("alice", TRAVEL, Role.HOST);
        join("bob", TRAVEL, Role.GUEST_WRITE);

        assertTrue(checker.isHost(travelToken("alice", TRAVEL), (long) TRAVEL));
        assertFalse(checker.isHost(travelToken("bob", TRAVEL), (long) TRAVEL));
        assertTrue(checker.isMember(travelToken("bob", TRAVEL), (long) TRAVEL));
    }
}
