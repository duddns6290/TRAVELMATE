package org.capstone.controller;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.capstone.entity.User;
import org.capstone.entity.userFriend.UserDTO;
import org.capstone.repository.UserRepository;
import org.capstone.service.RefreshTokenService;
import org.capstone.service.UserService;
import org.capstone.token.RefreshTokenCookie;
import org.capstone.token.TokenProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/user") //user
public class UserController {
    private final UserService userService;
    private final UserRepository userRepository;
    private final TokenProvider tokenProvider;
    private final RefreshTokenService refreshTokenService;

    public UserController(UserService userService, UserRepository userRepository,
                          TokenProvider tokenProvider, RefreshTokenService refreshTokenService) {
        this.userService = userService;
        this.userRepository = userRepository;
        this.tokenProvider = tokenProvider;
        this.refreshTokenService = refreshTokenService;
    }

    // 아이디/비밀번호 로그인: OAuth 로그인과 똑같이 Access Token(응답 body) + Refresh Token(HttpOnly 쿠키)을 발급한다
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody User request,
                                   HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        if (!userService.authenticate(request.getUserid(), request.getUserpw())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "아이디 또는 비밀번호가 올바르지 않습니다."));
        }

        String userId = request.getUserid();
        RefreshTokenCookie.set(httpRequest, httpResponse, refreshTokenService.issue(userId),
                tokenProvider.getRefreshTokenExpireMillis());
        return ResponseEntity.ok(Map.of(
                "userId", userId,
                "accessToken", tokenProvider.createAccessToken(userId)));
    }
    //Oauth에서 쓰는거
    @GetMapping("/loginInfo")
    public String getJson(Authentication authentication) {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        Map<String, Object> attributes = oAuth2User.getAttributes();
        return attributes.toString();
    }

    @GetMapping("/find/{userid}")
    public ResponseEntity<User> getUserByUserid(@PathVariable String userid) {
        Optional<User> user = userRepository.findByUserid(userid);
        return user.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @GetMapping("/{userId}/friends")
    @PreAuthorize("#userId == authentication.name") // 본인 친구 목록만
    public ResponseEntity<List<UserDTO>> getFriends(@PathVariable String userId) {
        List<UserDTO> friends = userService.getFriends(userId);
        return ResponseEntity.ok(friends);
    }

    @PostMapping("/add/{userId}/friends")
    @PreAuthorize("#userId == authentication.name") // 본인 친구 목록만
    public ResponseEntity<?> addFriend(@PathVariable String userId, @RequestBody Map<String, String> body) {
        String friendId = body.get("friendId");
        userService.addFriend(userId, friendId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{userId}/friends/request")
    @PreAuthorize("#userId == authentication.name") // 본인 친구 목록만
    public ResponseEntity<Void> requestFriend(@PathVariable String userId, @RequestBody Map<String, String> body) {
        String receiverId = body.get("friendId");
        userService.requestFriend(userId, receiverId);
        return ResponseEntity.ok().build();
    }
    //친구 요청 목록 get
    @GetMapping("/{userId}/friends/requested")
    @PreAuthorize("#userId == authentication.name") // 본인 친구 목록만
    public ResponseEntity<List<UserDTO>> getPendingRequests(@PathVariable String userId) {
        List<UserDTO> requests = userService.getPendingFriendRequests(userId);
        return ResponseEntity.ok(requests);
    }

    @PostMapping("/{userId}/friends/accept")
    @PreAuthorize("#userId == authentication.name") // 본인 친구 목록만
    public ResponseEntity<Void> acceptFriend(@PathVariable String userId, @RequestBody Map<String, String> body) {
        String requesterId = body.get("friendId"); // 요청 보낸 사람
        userService.acceptFriend(requesterId, userId); // userId가 수락
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{userId}/friends/{friendId}")
    @PreAuthorize("#userId == authentication.name") // 본인 친구 목록만
    public ResponseEntity<Void> deleteFriend(@PathVariable String userId, @PathVariable String friendId) {
        userService.deleteFriend(userId, friendId);
        return ResponseEntity.ok().build();
    }
}

