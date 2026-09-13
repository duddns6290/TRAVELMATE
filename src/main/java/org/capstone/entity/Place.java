package org.capstone.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalTime;

@Getter
@Setter
@Entity
@Table(name = "place")
public class Place {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int place_id;

    private String place_name;
    private String place_address;
    private String place_image;
    private String place_business_hour;
    private String place_holiday;
    private Integer place_stay_time;
    private Integer next_place_id;
    private LocalTime place_visiting_time;

    private Double latitude;
    private Double longitude;

    @Column(name = "travel_id")
    private Long travelId;

    private Integer selected_day;

    private String mongo;

}
