package org.capstone.repository;

import org.capstone.entity.userFriend.Friend;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FriendRepository extends JpaRepository<Friend, Long> {
    List<Friend> findByUserId(String userId);

    Optional<Friend> findByUserIdAndFriendId(String userId, String friendId);

    boolean existsByUserIdAndFriendId(String userId, String friendId);

    void deleteByUserIdAndFriendId(String userId, String friendId);
    List<Friend> findByUserIdAndStatus(String userId, String status);
    List<Friend> findByFriendIdAndStatus(String friendId, String status);

}
