package org.capstone.entity.userFriend;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "friends")
public class Friend {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String userId;
    private String friendId;
    private String status; // pending, accepted
    private LocalDateTime createdAt = LocalDateTime.now();

    public Friend(String userId, String friendId, String status) {
        this.userId = userId;
        this.friendId = friendId;
        this.status = status;
        this.createdAt = LocalDateTime.now();
    }

    public Friend(String userId, String friendId) {
        this.userId = userId;
        this.friendId = friendId;
    }
}

