package org.capstone.entity.userTravel;

import lombok.*;

import java.util.List;

@Getter
@Setter
@Data
@AllArgsConstructor
@NoArgsConstructor
public class TravelRequest {
    private Travel travel;
    private List<UserRoleRequest> users;
}
