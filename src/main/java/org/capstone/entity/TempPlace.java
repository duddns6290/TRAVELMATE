package org.capstone.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "temp_place")
@Getter
@Setter
@NoArgsConstructor
public class TempPlace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "temp_id")
    private Long id;

    @Column(name = "temp_name")
    private String name;

    @Column(name = "temp_address")
    private String address;

    @Column(name = "temp_image")
    private String image;

    @Column(name = "temp_business_hour")
    private String businessHour;

    @Column(name = "temp_holiday")
    private String holiday;

    private Double latitude;
    private Double longitude;

    @Column(name = "travel_id")
    private Long travelId;
}

