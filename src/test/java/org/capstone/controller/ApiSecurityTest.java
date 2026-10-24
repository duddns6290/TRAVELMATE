package org.capstone.controller;

import org.capstone.config.SecurityConfig;
import org.capstone.entity.Place;
import org.capstone.entity.Role;
import org.capstone.entity.TempPlace;
import org.capstone.entity.userTravel.TravelRequest;
import org.capstone.entity.userTravel.TravelUser;
import org.capstone.entity.userTravel.TravelUserId;
import org.capstone.entity.userTravel.UserRoleRequest;
import org.capstone.repository.PlaceRepository;
import org.capstone.repository.TempPlaceRepository;
import org.capstone.repository.TravelUserRepository;
import org.capstone.repository.UserRepository;
import org.capstone.service.*;
import org.capstone.token.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import jakarta.servlet.http.Cookie;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * 실제 SecurityConfig + JWT 필터 + @PreAuthorize(TravelAccessChecker)를 띄워 HTTP 요청 단위로 확인한다.
 * 서비스·저장소는 mock (DB 없음).
 *
 * 등장인물: alice = 여행 7의 HOST, bob = 여행 7의 GUEST_WRITE, 여행 8에는 alice만 있다(HOST).
 */
@WebMvcTest
@ContextConfiguration(classes = ApiSecurityTest.Config.class) // @Nested 클래스들도 메인 앱 대신 이 설정을 쓰도록
@TestPropertySource(properties = "jwt.secret=test-secret-key-for-unit-tests-only-0123456789")
class ApiSecurityTest {

    private static final int TRAVEL = 7;
    private static final int OTHER_TRAVEL = 8;

    @Configuration
    @Import({SecurityConfig.class, TokenProvider.class, TokenAuthenticationFilter.class,
            JwtAuthenticationEntryPoint.class, JwtAccessDeniedHandler.class, TravelAccessChecker.class,
            AuthController.class, UserController.class, TravelController.class, TravelUserController.class,
            PlaceController.class, TempPlaceController.class, PDF_Controller.class})
    static class Config {
        // OAuth 설정(.env)에 기대지 않도록 가짜 등록 정보를 둔다
        @Bean
        ClientRegistrationRepository clientRegistrationRepository() {
            return new InMemoryClientRegistrationRepository(ClientRegistration.withRegistrationId("test")
                    .clientId("test")
                    .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                    .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                    .authorizationUri("https://auth.example.test/authorize")
                    .tokenUri("https://auth.example.test/token")
                    .build());
        }
    }

    @Autowired MockMvc mvc;
    @Autowired TokenProvider tokenProvider;

    @MockitoBean TravelUserRepository travelUserRepository;
    @MockitoBean PlaceRepository placeRepository;
    @MockitoBean TempPlaceRepository tempPlaceRepository;
    @MockitoBean UserRepository userRepository;
    @MockitoBean RefreshTokenService refreshTokenService;
    @MockitoBean UserService userService;
    @MockitoBean TravelUserService travelUserService;
    @MockitoBean TravelService travelService;
    @MockitoBean S3FileUploadService s3FileUploadService;
    @MockitoBean PlaceService placeService;
    @MockitoBean PlaceLockService placeLockService;
    @MockitoBean PlaceOrderService placeOrderService;
    @MockitoBean TempPlaceService tempPlaceService;
    @MockitoBean PDF_Service pdfService;
    @MockitoBean CustomOAuth2UserService customOAuth2UserService;
    @MockitoBean OAuth2SuccessHandler oAuth2SuccessHandler;

    @BeforeEach
    void setUp() {
        when(travelUserRepository.findById(any())).thenReturn(Optional.empty());
        join("alice", TRAVEL, Role.HOST);
        join("bob", TRAVEL, Role.GUEST_WRITE);
        join("alice", OTHER_TRAVEL, Role.HOST);
    }

    private void join(String userId, int travelId, Role role) {
        TravelUser tu = new TravelUser();
        tu.setId(new TravelUserId(travelId, userId));
        tu.setRole(role);
        when(travelUserRepository.findById(new TravelUserId(travelId, userId))).thenReturn(Optional.of(tu));
    }

    private String login(String userId) {
        return "Bearer " + tokenProvider.createAccessToken(userId);
    }

    private String travel(String userId, int travelId) {
        return "Bearer " + tokenProvider.createTravelToken(userId, travelId, "host");
    }

    private Integer travelIdOf(MvcResult result) throws Exception {
        String token = com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.token");
        return ((JwtUser) tokenProvider.getAuthentication(token).getPrincipal()).getTravelId();
    }

    @Nested
    class 인증_필터 {

        @Test
        void 토큰이_없으면_401() throws Exception {
            mvc.perform(get("/travel/alice")).andExpect(status().isUnauthorized());
        }

        @Test
        void 위조_토큰이면_401() throws Exception {
            mvc.perform(get("/travel/alice").header(HttpHeaders.AUTHORIZATION, "Bearer not.a.jwt"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        void Refresh_Token을_Bearer로_보내면_401() throws Exception {
            String refresh = tokenProvider.createRefreshToken("alice");

            mvc.perform(get("/travel/alice").header(HttpHeaders.AUTHORIZATION, "Bearer " + refresh))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        void 로그인_토큰이면_통과() throws Exception {
            mvc.perform(get("/travel/alice").header(HttpHeaders.AUTHORIZATION, login("alice")))
                    .andExpect(status().isOk());
        }

        @Test
        void 날씨_같은_공개_API는_토큰_없이도_보안에서_막지_않는다() throws Exception {
            // 컨트롤러를 띄우지 않았으므로 404면 시큐리티는 통과한 것
            mvc.perform(get("/api/weather/seoul")).andExpect(status().isNotFound());
        }
    }

    @Nested
    class 아이디_비밀번호_로그인 {

        @Test
        void 성공하면_Access_Token은_body로_Refresh_Token은_쿠키로() throws Exception {
            when(userService.authenticate("alice", "pw")).thenReturn(true);
            when(refreshTokenService.issue("alice")).thenReturn("refresh-1");

            mvc.perform(post("/user/login").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"userid\":\"alice\",\"userpw\":\"pw\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.userId").value("alice"))
                    .andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(header().string(HttpHeaders.SET_COOKIE, allOf(
                            startsWith("refreshToken=refresh-1"), containsString("HttpOnly"))));
        }

        @Test
        void 실패하면_401이고_쿠키도_없다() throws Exception {
            when(userService.authenticate("alice", "wrong")).thenReturn(false);

            mvc.perform(post("/user/login").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"userid\":\"alice\",\"userpw\":\"wrong\"}"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
            verify(refreshTokenService, never()).issue(any());
        }
    }

    @Nested
    class 토큰_재발급 {

        @Test
        void 쿠키가_없으면_401이고_쿠키를_지운다() throws Exception {
            mvc.perform(post("/auth/refresh"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")));
        }

        @Test
        void 쓸_수_없는_Refresh_Token이면_401() throws Exception {
            when(refreshTokenService.rotate("used")).thenReturn(Optional.empty());

            mvc.perform(post("/auth/refresh").cookie(new Cookie(RefreshTokenCookie.NAME, "used")))
                    .andExpect(status().isUnauthorized())
                    .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")));
        }

        @Test
        void 성공하면_새_Access_Token과_새_Refresh_Token_쿠키() throws Exception {
            when(refreshTokenService.rotate("old"))
                    .thenReturn(Optional.of(new RefreshTokenService.Rotation("alice", "new")));

            MvcResult result = mvc.perform(post("/auth/refresh").cookie(new Cookie(RefreshTokenCookie.NAME, "old")))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.SET_COOKIE, startsWith("refreshToken=new")))
                    .andReturn();

            assertNull(travelIdOf(result)); // travelId를 안 보냈으면 로그인 토큰
        }

        @Test
        void travelId를_보내고_참여자면_여행_토큰으로() throws Exception {
            when(refreshTokenService.rotate("old"))
                    .thenReturn(Optional.of(new RefreshTokenService.Rotation("bob", "new")));

            MvcResult result = mvc.perform(post("/auth/refresh").cookie(new Cookie(RefreshTokenCookie.NAME, "old"))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"travelId\":" + TRAVEL + "}"))
                    .andExpect(status().isOk())
                    .andReturn();

            assertEquals(TRAVEL, travelIdOf(result));
        }

        @Test
        void 그새_여행에서_빠졌으면_로그인_토큰으로() throws Exception {
            when(refreshTokenService.rotate("old"))
                    .thenReturn(Optional.of(new RefreshTokenService.Rotation("bob", "new")));

            MvcResult result = mvc.perform(post("/auth/refresh").cookie(new Cookie(RefreshTokenCookie.NAME, "old"))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"travelId\":" + OTHER_TRAVEL + "}"))
                    .andExpect(status().isOk())
                    .andReturn();

            assertNull(travelIdOf(result));
        }

        @Test
        void Access_Token이_만료돼도_재발급은_부를_수_있다() throws Exception {
            when(refreshTokenService.rotate("old"))
                    .thenReturn(Optional.of(new RefreshTokenService.Rotation("alice", "new")));

            mvc.perform(post("/auth/refresh").cookie(new Cookie(RefreshTokenCookie.NAME, "old"))
                            .header(HttpHeaders.AUTHORIZATION, "Bearer expired.or.broken"))
                    .andExpect(status().isOk());
        }
    }

    @Nested
    class 로그아웃 {

        @Test
        void Refresh_Token을_폐기하고_쿠키를_지운다() throws Exception {
            mvc.perform(post("/auth/logout").cookie(new Cookie(RefreshTokenCookie.NAME, "tok")))
                    .andExpect(status().isNoContent())
                    .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")));
            verify(refreshTokenService).revoke("tok");
        }

        @Test
        void 쿠키가_없어도_204() throws Exception {
            mvc.perform(post("/auth/logout")).andExpect(status().isNoContent());
            verify(refreshTokenService, never()).revoke(any());
        }
    }

    @Nested
    class 여행_전환 {

        @Test
        void 토큰_없이는_401() throws Exception {
            mvc.perform(post("/auth/switch-travel").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"travelId\":" + TRAVEL + "}"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        void body의_userId는_무시하고_토큰의_사용자로_발급한다() throws Exception {
            // carol은 여행 7에 없지만 body에 bob을 적어 bob의 여행 토큰을 받으려 한다
            mvc.perform(post("/auth/switch-travel").header(HttpHeaders.AUTHORIZATION, login("carol"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"travelId\":" + TRAVEL + ",\"userId\":\"bob\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        void 참여자면_그_여행의_토큰을_준다() throws Exception {
            MvcResult result = mvc.perform(post("/auth/switch-travel").header(HttpHeaders.AUTHORIZATION, login("bob"))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"travelId\":" + TRAVEL + "}"))
                    .andExpect(status().isOk())
                    .andReturn();

            assertEquals(TRAVEL, travelIdOf(result));
        }
    }

    @Nested
    class 본인_것만 {

        @Test
        void 남의_여행_목록은_403() throws Exception {
            mvc.perform(get("/travel/bob").header(HttpHeaders.AUTHORIZATION, login("alice")))
                    .andExpect(status().isForbidden());
        }

        @Test
        void 남의_친구_목록은_403() throws Exception {
            mvc.perform(get("/user/bob/friends").header(HttpHeaders.AUTHORIZATION, login("alice")))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/user/alice/friends").header(HttpHeaders.AUTHORIZATION, login("alice")))
                    .andExpect(status().isOk());
        }

        @Test
        void 여행을_만들면_호스트는_항상_로그인한_사용자() throws Exception {
            MockMultipartFile travelPart = new MockMultipartFile("travel", "", "application/json", "{}".getBytes());
            MockMultipartFile usersPart = new MockMultipartFile("users", "", "application/json",
                    "[{\"userId\":\"bob\",\"role\":\"HOST\"},{\"userId\":\"carol\",\"role\":\"GUEST_READ\"}]".getBytes());

            mvc.perform(multipart("/travel").file(travelPart).file(usersPart)
                            .header(HttpHeaders.AUTHORIZATION, login("alice")))
                    .andExpect(status().isOk());

            ArgumentCaptor<TravelRequest> captor = ArgumentCaptor.forClass(TravelRequest.class);
            verify(travelService).createTravelWithUsers(captor.capture());
            List<UserRoleRequest> users = captor.getValue().getUsers();
            assertEquals(2, users.size());
            assertEquals("alice", users.get(0).getUserId());
            assertEquals(Role.HOST, users.get(0).getRole());
            assertEquals("carol", users.get(1).getUserId()); // HOST로 끼워 넣은 bob은 빠진다
        }
    }

    @Nested
    class 마이페이지_기능은_참여자_또는_호스트 {

        @Test
        void 여행_수정_삭제는_호스트만() throws Exception {
            mvc.perform(delete("/travel/" + TRAVEL).header(HttpHeaders.AUTHORIZATION, login("bob")))
                    .andExpect(status().isForbidden());
            mvc.perform(delete("/travel/" + TRAVEL).header(HttpHeaders.AUTHORIZATION, login("alice")))
                    .andExpect(status().isNoContent());
        }

        @Test
        void 참여자_목록은_참여자만_볼_수_있다() throws Exception {
            mvc.perform(get("/traveluser/" + TRAVEL).header(HttpHeaders.AUTHORIZATION, login("bob")))
                    .andExpect(status().isOk());
            mvc.perform(get("/traveluser/" + TRAVEL).header(HttpHeaders.AUTHORIZATION, login("carol")))
                    .andExpect(status().isForbidden());
        }

        @Test
        void 권한_변경은_호스트만() throws Exception {
            mvc.perform(put("/traveluser/role").header(HttpHeaders.AUTHORIZATION, login("bob"))
                            .param("travelId", "" + TRAVEL).param("userId", "bob").param("roleKey", "HOST"))
                    .andExpect(status().isForbidden());
            mvc.perform(put("/traveluser/role").header(HttpHeaders.AUTHORIZATION, login("alice"))
                            .param("travelId", "" + TRAVEL).param("userId", "bob").param("roleKey", "GUEST_READ"))
                    .andExpect(status().isOk());
        }

        @Test
        void PDF는_참여자만() throws Exception {
            mvc.perform(get("/pdf/travel/" + OTHER_TRAVEL + "/timetable").header(HttpHeaders.AUTHORIZATION, login("bob")))
                    .andExpect(status().isForbidden());
        }
    }

    @Nested
    class 여행_안의_기능은_그_여행의_토큰 {

        @Test
        void 로그인_토큰으로는_장소를_볼_수_없다() throws Exception {
            mvc.perform(get("/place/travel/" + TRAVEL).header(HttpHeaders.AUTHORIZATION, login("alice")))
                    .andExpect(status().isForbidden());
        }

        @Test
        void 그_여행의_토큰이면_장소를_볼_수_있다() throws Exception {
            mvc.perform(get("/place/travel/" + TRAVEL).header(HttpHeaders.AUTHORIZATION, travel("alice", TRAVEL)))
                    .andExpect(status().isOk());
        }

        @Test
        void 다른_여행의_토큰으로는_403() throws Exception {
            // alice는 두 여행 모두 참여자지만, 여행 7 토큰으로 여행 8에 접근할 수는 없다
            mvc.perform(get("/place/travel/" + OTHER_TRAVEL).header(HttpHeaders.AUTHORIZATION, travel("alice", TRAVEL)))
                    .andExpect(status().isForbidden());
        }

        @Test
        void 장소_등록은_body의_travelId로_검사한다() throws Exception {
            mvc.perform(post("/place").header(HttpHeaders.AUTHORIZATION, travel("bob", TRAVEL))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"travelId\":" + OTHER_TRAVEL + "}"))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/place").header(HttpHeaders.AUTHORIZATION, travel("bob", TRAVEL))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"travelId\":" + TRAVEL + "}"))
                    .andExpect(status().isOk());
        }

        @Test
        void 순서_변경도_body의_travelId로_검사한다() throws Exception {
            mvc.perform(post("/place/move").header(HttpHeaders.AUTHORIZATION, travel("bob", TRAVEL))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"travelId\":" + OTHER_TRAVEL + ",\"day\":1,\"placeId\":1,\"toIndex\":0,\"userId\":\"bob\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        void 장소_id로_들어오면_그_장소가_속한_여행으로_검사한다() throws Exception {
            Place others = new Place();
            others.setTravelId((long) OTHER_TRAVEL);
            when(placeRepository.findById(99)).thenReturn(Optional.of(others));

            mvc.perform(delete("/place/99").header(HttpHeaders.AUTHORIZATION, travel("bob", TRAVEL)))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/place/99/visiting-time").header(HttpHeaders.AUTHORIZATION, travel("bob", TRAVEL)))
                    .andExpect(status().isForbidden());
        }

        @Test
        void 스크랩_장소도_그_여행의_토큰이어야_한다() throws Exception {
            TempPlace others = new TempPlace();
            others.setTravelId((long) OTHER_TRAVEL);
            when(tempPlaceRepository.findById(5L)).thenReturn(Optional.of(others));

            mvc.perform(get("/tempplace/5").header(HttpHeaders.AUTHORIZATION, travel("bob", TRAVEL)))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/tempplace").header(HttpHeaders.AUTHORIZATION, travel("bob", TRAVEL))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"travelId\":" + OTHER_TRAVEL + "}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        void 여행에서_빠진_뒤에는_예전_여행_토큰도_403() throws Exception {
            String bobToken = travel("bob", TRAVEL);
            when(travelUserRepository.findById(new TravelUserId(TRAVEL, "bob"))).thenReturn(Optional.empty());

            mvc.perform(get("/place/travel/" + TRAVEL).header(HttpHeaders.AUTHORIZATION, bobToken))
                    .andExpect(status().isForbidden());
        }
    }
}
