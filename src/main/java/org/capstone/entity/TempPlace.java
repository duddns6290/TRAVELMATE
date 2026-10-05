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

    // 스크랩한 사람 (사람별로 스크랩 목록을 나눠 보여주는 데 사용). 기존 데이터는 null.
    @Column(name = "user_id")
    private String userId;

    // 식당 상세정보(MongoDB) id. 타임테이블로 옮길 때 place.mongo로 넘겨 상세 보기가 되도록 한다. (구글 장소 등은 null)
    @Column(name = "restaurant_id")
    private String restaurantId;
}

