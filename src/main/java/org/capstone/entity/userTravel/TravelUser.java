package org.capstone.entity.userTravel;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.capstone.entity.Role;

@Setter
@Getter
@Entity
@Table(name = "travel_user")
public class TravelUser {
    @EmbeddedId
    private TravelUserId id;
    @Enumerated(EnumType.STRING)
    private Role role;

}
