package org.capstone.controller;

import lombok.RequiredArgsConstructor;
import org.capstone.service.RouteInfo;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/route")
public class RouteController {

    private final RouteInfo routeInfo;

    @GetMapping("/v2")
    public Map<String, String> getRouteV2(
            @RequestParam String fromName,
            @RequestParam double fromLon,
            @RequestParam double fromLat,
            @RequestParam String toName,
            @RequestParam double toLon,
            @RequestParam double toLat,
            @RequestParam String mode) {

        if(mode.equals("car")){
            String url = routeInfo.getRouteUrl(fromName, fromLon, fromLat, toName, toLon, toLat, mode);
            Map<String, String> result = new HashMap<>();
            result.put("url", url);
            result.put("estimatedTime", null);
            return result;
        }else{
            // URL 생성
            String url = routeInfo.getRouteUrl(fromName, fromLon, fromLat, toName, toLon, toLat, mode);

            // 거리/시간 정보 가져오기 (모든 인자 넘김)
            String time = routeInfo.getRouteEstimatedTime(fromName, fromLon, fromLat, toName, toLon, toLat, mode);

            // 결과 반환
            Map<String, String> result = new HashMap<>();
            result.put("url", url);
            result.put("estimatedTime", time);
            return result;
        }
    }
}
