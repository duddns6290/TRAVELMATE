package org.capstone.controller;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.weather.Weather;
import org.capstone.service.WeatherService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/weather")
public class WeatherController {
    private final WeatherService weatherService;

    @GetMapping
    public List<Weather> getWeatherByCoordinates(@RequestParam double lat, @RequestParam double lng) {
        return weatherService.getWeather(lat, lng);
    }
}
