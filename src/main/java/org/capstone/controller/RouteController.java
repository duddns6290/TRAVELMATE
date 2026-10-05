package org.capstone.controller;

import lombok.RequiredArgsConstructor;
import org.capstone.service.RouteInfo;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/route")
public class RouteController {

    private final RouteInfo routeInfo;

    // 대중교통 경로 후보 (어떤 버스/지하철을 몇 분 타는지). 이동시간 칸을 눌렀을 때 보여준다.
    @GetMapping("/transit-options")
    public List<Map<String, Object>> getTransitOptions(
            @RequestParam String fromName,
            @RequestParam double fromLon,
            @RequestParam double fromLat,
            @RequestParam String toName,
            @RequestParam double toLon,
            @RequestParam double toLat,
            @RequestParam(defaultValue = "3") int limit) {
        return routeInfo.getTransitOptions(fromName, fromLon, fromLat, toName, toLon, toLat, Math.min(limit, 5));
    }

    @GetMapping("/v2")
    public Map<String, String> getRouteV2(
            @RequestParam String fromName,
            @RequestParam double fromLon,
            @RequestParam double fromLat,
            @RequestParam String toName,
            @RequestParam double toLon,
            @RequestParam double toLat,
            @RequestParam String mode) {

        // 도보/자동차/대중교통 모두 네이버 지도 길찾기로 계산 (mode: walk | car | transmit)
        String url = routeInfo.getRouteUrl(fromName, fromLon, fromLat, toName, toLon, toLat, mode);
        String time = routeInfo.getRouteEstimatedTime(fromName, fromLon, fromLat, toName, toLon, toLat, mode);

        Map<String, String> result = new HashMap<>();
        result.put("url", url);
        result.put("estimatedTime", time);
        return result;
    }
}
