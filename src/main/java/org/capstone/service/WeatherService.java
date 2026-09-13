package org.capstone.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.capstone.entity.weather.Weather;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WeatherService {
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${visualcrossing.api.key}")
    private String apiKey;

    public List<Weather> getWeather(double lat, double lng) {
        String url = String.format(
                "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/%.6f,%.6f?unitGroup=metric&key=%s&contentType=json",
                lat, lng, apiKey
        );

        System.out.println("▶ 날씨 API 요청 URL: " + url);  // 디버깅용

        return fetchWeatherData(url);
    }

    private List<Weather> fetchWeatherData(String url) {
        List<Weather> result = new ArrayList<>();
        try {
            String response = restTemplate.getForObject(url, String.class);
            JsonNode root = objectMapper.readTree(response);
            JsonNode days = root.get("days");

            for (JsonNode day : days) {
                String datetime = day.get("datetime").asText();
                double tempMax = day.get("tempmax").asDouble();
                double tempMin = day.get("tempmin").asDouble();
                double precip = day.get("precip").asDouble();
                double windSpeed = day.get("windspeed").asDouble();

                String precipType = "맑음";
                JsonNode typeNode = day.get("preciptype");
                if (typeNode != null && typeNode.isArray() && typeNode.size() > 0) {
                    precipType = typeNode.get(0).asText();
                }

                result.add(new Weather(datetime, tempMax, tempMin, precip, precipType, windSpeed));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return result;
    }
}
