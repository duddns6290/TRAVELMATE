package org.capstone.entity.weather;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Weather {
    private String date;          // 날짜
    private double tempMax;       // 최고 기온
    private double tempMin;       // 최저 기온
    private double precip;        // 강수량
    private String precipType;    // 강수 타입 (비/ 눈/ null)
    private double windSpeed;     // 평균 풍속
}
