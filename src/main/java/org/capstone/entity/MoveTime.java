package org.capstone.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "move_time")
@Getter
@Setter
@NoArgsConstructor
public class MoveTime {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "mvn_id")
    private Long id;

    @Column(name = "mvn_type")
    private String type;

    @Column(name = "mvn_time")
    private String time;

    @Column(name = "mvn_distance")
    private String distance;

    @Column(name = "mvn_departure_place")
    private Integer departurePlace;

    // 네이버 길찾기 URL은 장소 이름이 인코딩돼 255자를 넘기 쉬워서 TEXT로 둔다
    @Column(name = "url", columnDefinition = "TEXT")
    private String url;
}

