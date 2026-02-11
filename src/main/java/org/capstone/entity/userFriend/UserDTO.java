package org.capstone.entity.userFriend;

import lombok.Getter;
import lombok.Setter;
import org.capstone.entity.User;

@Getter
@Setter
public class UserDTO {
    private String userid;
    private String name;
    private String email;

    public UserDTO(User user) {
        this.userid = user.getUserid();
        this.name = user.getName();
        this.email = user.getEmail();
    }
}
