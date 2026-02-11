package org.capstone.entity.userTravel;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TravelUserResponse {
    private String userId;
    private String name;
    private String email;
    private String role;
}

