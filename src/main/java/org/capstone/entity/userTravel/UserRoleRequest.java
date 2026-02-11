package org.capstone.entity.userTravel;

import lombok.Getter;
import lombok.Setter;
import org.capstone.entity.Role;

@Getter
@Setter
public class UserRoleRequest {
    private String userId;
    private Role role;
}

