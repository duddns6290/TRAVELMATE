package org.capstone.service;

import jakarta.transaction.Transactional;
import org.capstone.entity.userFriend.Friend;
import org.capstone.entity.User;
import org.capstone.entity.userFriend.UserDTO;
import org.capstone.repository.FriendRepository;
import org.capstone.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Optional;
import java.util.logging.Logger;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class UserService {
    private static final Logger logger = Logger.getLogger(UserService.class.getName());
    // BCrypt 해시 형식: $2a$10$ + 53자
    private static final Pattern BCRYPT = Pattern.compile("^\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}$");

    private final UserRepository userRepository;
    private final FriendRepository friendRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, FriendRepository friendRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.friendRepository = friendRepository;
        this.passwordEncoder = passwordEncoder;
    }


    // 아이디/비밀번호 로그인. 비밀번호는 BCrypt 해시로 비교한다.
    // 예전에 평문으로 저장된 비밀번호는 로그인에 성공하는 순간 해시로 바꿔 저장한다 (다음부터는 해시로만 비교).
    @Transactional
    public boolean authenticate(String userid, String password) {
        logger.info("Authenticating user: " + userid);
        if (userid == null || password == null) return false;

        return userRepository.findByUserid(userid)
                .map(user -> {
                    String stored = user.getUserpw();
                    if (stored == null) return false; // OAuth로만 가입한 계정

                    if (BCRYPT.matcher(stored).matches()) {
                        return passwordEncoder.matches(password, stored);
                    }

                    boolean ok = MessageDigest.isEqual(
                            stored.getBytes(StandardCharsets.UTF_8), password.getBytes(StandardCharsets.UTF_8));
                    if (ok) {
                        user.setUserpw(passwordEncoder.encode(password));
                        userRepository.save(user);
                        logger.info("평문 비밀번호를 BCrypt 해시로 전환: " + userid);
                    }
                    return ok;
                })
                .orElse(false);
    }


    public List<UserDTO> getFriends(String userId) {
        List<Friend> relations = friendRepository.findByUserIdAndStatus(userId, "ACCEPTED");
        return relations.stream()
                .map(rel -> userRepository.findById(rel.getFriendId()))
                .filter(Optional::isPresent)
                .map(opt -> new UserDTO(opt.get()))
                .collect(Collectors.toList());
    }

    public List<UserDTO> getPendingFriendRequests(String userId) {
        List<Friend> pendingRequests = friendRepository.findByFriendIdAndStatus(userId, "PENDING");
        return pendingRequests.stream()
                .map(req -> userRepository.findById(req.getUserId())) // 요청 보낸 사람 ID
                .filter(Optional::isPresent)
                .map(opt -> new UserDTO(opt.get()))
                .collect(Collectors.toList());
    }

    // 양방향
    @Transactional
    public void addFriend(String userId, String friendId) {
        Friend friend1 = new Friend(userId, friendId);
        Friend friend2 = new Friend(friendId, userId);
        friendRepository.saveAll(List.of(friend1, friend2));
    }


    public void requestFriend(String requesterId, String receiverId) {
        if (friendRepository.existsByUserIdAndFriendId(requesterId, receiverId)) {
               throw new IllegalStateException("이미 요청된 유저입니다.");
        }
        Friend request = new Friend(requesterId, receiverId, "PENDING");
        friendRepository.save(request);
    }

    @Transactional
    public void acceptFriend(String requesterId, String receiverId) {
        // 요청한 쪽 (A → B)
        Friend request = friendRepository
            .findByUserIdAndFriendId(requesterId, receiverId)
            .orElseThrow(() -> new IllegalStateException("수락할 친구 요청이 없습니다."));

        if (!"PENDING".equals(request.getStatus())) {
            throw new IllegalStateException("이미 수락되었거나 잘못된 요청입니다.");
        }
        // A → B 수락 처리
        request.setStatus("ACCEPTED");
        friendRepository.save(request);

        // B → A가 이미 있으면 상태만 수정, 없으면 새로 삽입
        Optional<Friend> reverseOpt = friendRepository.findByUserIdAndFriendId(receiverId, requesterId);
        if (reverseOpt.isPresent()) {
            Friend reverse = reverseOpt.get();
            reverse.setStatus("ACCEPTED");
            friendRepository.save(reverse);
        } else {
            Friend reverse = new Friend(receiverId, requesterId, "ACCEPTED");
            friendRepository.save(reverse);
        }
    }

    // 양방향
    @Transactional
    public void deleteFriend(String userId, String friendId) {
        friendRepository.deleteByUserIdAndFriendId(userId, friendId);
        friendRepository.deleteByUserIdAndFriendId(friendId, userId);
    }
}
