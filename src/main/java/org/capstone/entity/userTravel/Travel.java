package org.capstone.entity.userTravel;
import jakarta.persistence.*;
import java.time.LocalDate;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
@Entity
@Table(name = "travel")
public class Travel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "travel_id")
    private int travel_id;

    private String travel_name;
    private LocalDate travel_start_date;
    private LocalDate travel_end_date;
    @Column(name = "travel_period", insertable = false, updatable = false)
    private Integer travel_period;
    private String travel_image;

}

