package org.capstone.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.capstone.entity.User;
import org.capstone.repository.FriendRepository;
import org.capstone.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 아이디/비밀번호 로그인: BCrypt 비교와 평문 비밀번호의 자동 해시 전환.
 */
class UserServicePasswordTest {

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private UserRepository userRepo;
    private UserService service;
    private User user;

    @BeforeEach
    void setUp() {
        userRepo = mock(UserRepository.class);
        service = new UserService(userRepo, mock(FriendRepository.class), encoder);
        user = User.builder().userid("alice").build();
        when(userRepo.findByUserid("alice")).thenReturn(Optional.of(user));
    }

    @Test
    void 해시로_저장된_비밀번호는_BCrypt로_비교한다() {
        user.setUserpw(encoder.encode("pw1234"));

        assertTrue(service.authenticate("alice", "pw1234"));
        assertFalse(service.authenticate("alice", "wrong"));
        verify(userRepo, never()).save(any());
    }

    @Test
    void 평문_비밀번호는_로그인에_성공하면_해시로_바뀐다() {
        user.setUserpw("pw1234");

        assertTrue(service.authenticate("alice", "pw1234"));

        assertNotEquals("pw1234", user.getUserpw());
        assertTrue(user.getUserpw().startsWith("$2"));
        assertTrue(encoder.matches("pw1234", user.getUserpw()));
        verify(userRepo).save(user);

        // 다음 로그인부터는 해시로 비교
        assertTrue(service.authenticate("alice", "pw1234"));
        assertFalse(service.authenticate("alice", "wrong"));
    }

    @Test
    void 평문_비밀번호가_틀리면_그대로_둔다() {
        user.setUserpw("pw1234");

        assertFalse(service.authenticate("alice", "wrong"));
        assertEquals("pw1234", user.getUserpw());
        verify(userRepo, never()).save(any());
    }

    @Test
    void OAuth_계정이나_없는_계정은_실패() {
        user.setUserpw(null);

        assertFalse(service.authenticate("alice", "anything"));
        assertFalse(service.authenticate("nobody", "anything"));
        assertFalse(service.authenticate("alice", null));
    }

    @Test
    void 비밀번호는_응답_JSON에_나가지_않지만_요청으로는_받는다() throws Exception {
        ObjectMapper om = new ObjectMapper();
        user.setUserpw(encoder.encode("pw1234"));

        assertFalse(om.writeValueAsString(user).contains("userpw"));
        assertEquals("pw1234", om.readValue("{\"userid\":\"a\",\"userpw\":\"pw1234\"}", User.class).getUserpw());
    }
}
