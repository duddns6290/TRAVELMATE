package org.capstone.entity.userTravel;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

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

    // travel_period가 DB에서 NULL이면 시작/종료일로 계산
    public Integer getTravel_period() {
        if (travel_period == null && travel_start_date != null && travel_end_date != null) {
            return (int) ChronoUnit.DAYS.between(travel_start_date, travel_end_date) + 1;
        }
        return travel_period;
    }

}

