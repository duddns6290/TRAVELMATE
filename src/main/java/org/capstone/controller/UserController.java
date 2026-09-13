package org.capstone.controller;
import jakarta.servlet.http.HttpSession;
import org.capstone.entity.User;
import org.capstone.entity.userFriend.UserDTO;
import org.capstone.repository.UserRepository;
import org.capstone.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

    public UserController(UserService userService, UserRepository userRepository) {
        this.userService = userService;
        this.userRepository = userRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody User request, HttpSession session) {
        if (userService.authenticate(request.getUserid(), request.getUserpw())) {
            session.setAttribute("userid", request.getUserid());
            return ResponseEntity.ok(request.getUserid());
        } else {
            return ResponseEntity.status(401).body("Invalid credentials");
        }
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
    public ResponseEntity<List<UserDTO>> getFriends(@PathVariable String userId) {
        List<UserDTO> friends = userService.getFriends(userId);
        return ResponseEntity.ok(friends);
    }

    @PostMapping("/add/{userId}/friends")
    public ResponseEntity<?> addFriend(@PathVariable String userId, @RequestBody Map<String, String> body) {
        String friendId = body.get("friendId");
        userService.addFriend(userId, friendId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{userId}/friends/request")
    public ResponseEntity<Void> requestFriend(@PathVariable String userId, @RequestBody Map<String, String> body) {
        String receiverId = body.get("friendId");
        userService.requestFriend(userId, receiverId);
        return ResponseEntity.ok().build();
    }
    //친구 요청 목록 get
    @GetMapping("/{userId}/friends/requested")
    public ResponseEntity<List<UserDTO>> getPendingRequests(@PathVariable String userId) {
        List<UserDTO> requests = userService.getPendingFriendRequests(userId);
        return ResponseEntity.ok(requests);
    }

    @PostMapping("/{userId}/friends/accept")
    public ResponseEntity<Void> acceptFriend(@PathVariable String userId, @RequestBody Map<String, String> body) {
        String requesterId = body.get("friendId"); // 요청 보낸 사람
        userService.acceptFriend(requesterId, userId); // userId가 수락
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{userId}/friends/{friendId}")
    public ResponseEntity<Void> deleteFriend(@PathVariable String userId, @PathVariable String friendId) {
        userService.deleteFriend(userId, friendId);
        return ResponseEntity.ok().build();
    }
}

