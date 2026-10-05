package org.capstone.service;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.GZIPInputStream;

/**
 * 네이버 지도 길찾기(도보/자동차/대중교통)로 이동시간과 거리를 가져온다.
 * 결과 형식: "N분 / X.XXkm". 실패하면 "... 실패" 또는 "... 예외 발생: ..." 문자열을 돌려준다.
 */
@Service
public class RouteInfo {

    private static final String NAVER_DIRECTIONS = "https://map.naver.com/p/api/directions/";
    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public String getRouteUrl(String fromName, double fromLon, double fromLat,
                              String toName, double toLon, double toLat, String mode) {
        return RouteURL.buildRouteUrl(fromName, fromLon, fromLat, toName, toLon, toLat, mode);
    }

    public String getRouteEstimatedTime(String fromName, double fromLon, double fromLat,
                                        String toName, double toLon, double toLat, String mode) {
        return switch (mode) {
            case "walk" -> getWalkRouteInfo(fromName, toName, fromLon, fromLat, toLon, toLat);
            case "car" -> getCarRouteInfo(fromLon, fromLat, toLon, toLat);
            case "transmit" -> getTransitRouteInfo(fromName, fromLon, fromLat, toName, toLon, toLat);
            default -> "지원하지 않는 모드입니다.";
        };
    }

    // 🚶 도보
    public String getWalkRouteInfo(String startName, String endName,
                                   double startLon, double startLat,
                                   double endLon, double endLat) {
        try {
            String url = NAVER_DIRECTIONS + "walk"
                    + "?o=reco,wide,flat"
                    + "&l=" + startLon + "," + startLat + ",placeid%3D0,name%3D" + encode(startName) + "%3B"
                    + endLon + "," + endLat + ",placeid%3D0,name%3D" + encode(endName)
                    + "&e=1";

            JSONObject summary = fetchJson(url).getJSONArray("routes").getJSONObject(0).getJSONObject("summary");
            return format(summary.getInt("duration") / 60, summary.getInt("distance"));
        } catch (Exception e) {
            e.printStackTrace();
            return "도보 경로 처리 중 예외 발생: " + e.getMessage();
        }
    }

    // 🚗 자동차 (duration은 밀리초)
    public String getCarRouteInfo(double startLon, double startLat, double endLon, double endLat) {
        try {
            String url = NAVER_DIRECTIONS + "car"
                    + "?start=" + startLon + "," + startLat
                    + "&goal=" + endLon + "," + endLat;

            JSONObject json = fetchJson(url);
            JSONObject routes = json.optJSONObject("route");
            if (routes == null || routes.isEmpty()) {
                return "자동차 경로 요청 실패: " + json.optString("message", "경로 없음");
            }
            // route는 {"옵션키": [경로...]} 형태라 첫 번째 옵션의 첫 경로를 쓴다
            String firstKey = routes.keys().next();
            JSONObject summary = routes.getJSONArray(firstKey).getJSONObject(0).getJSONObject("summary");

            int minutes = (int) Math.round(summary.getLong("duration") / 60000.0);
            return format(Math.max(minutes, 1), summary.getInt("distance"));
        } catch (Exception e) {
            e.printStackTrace();
            return "자동차 경로 처리 중 예외 발생: " + e.getMessage();
        }
    }

    // 네이버 대중교통 길찾기 원본 응답
    private JSONObject fetchTransitJson(String fromName, double fromLon, double fromLat,
                                        String toName, double toLon, double toLat) throws IOException, InterruptedException {
        String departureTime = LocalDateTime.now().withNano(0).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        String url = NAVER_DIRECTIONS + "pubtrans"
                + "?start=" + fromLon + "," + fromLat + ",placeid%3D0,name%3D" + encode(fromName)
                + "&goal=" + toLon + "," + toLat + ",placeid%3D0,name%3D" + encode(toName)
                + "&crs=EPSG:4326&includeDetailOperation=true&lang=ko"
                + "&supportFerry=true&mode=TIME&departureTime=" + departureTime;
        return fetchJson(url);
    }

    // 지금 시각에 운행하는 차가 없으면(심야 등) paths가 비어 있다 → 시간표와 무관한 평소 경로(staticPaths)를 쓴다
    private static JSONArray transitPaths(JSONObject json) {
        JSONArray paths = json.optJSONArray("paths");
        if (paths == null || paths.isEmpty()) paths = json.optJSONArray("staticPaths");
        return paths;
    }

    /**
     * 대중교통 경로 후보(최대 limit개)를 화면에 보여주기 좋은 형태로 정리한다.
     * [{ duration, walkingDuration, transferCount, distance, steps: [{ type, duration, routes:[이름], from, to, stopCount, headsign }] }]
     */
    public List<Map<String, Object>> getTransitOptions(String fromName, double fromLon, double fromLat,
                                                      String toName, double toLon, double toLat, int limit) {
        List<Map<String, Object>> options = new ArrayList<>();
        try {
            JSONArray paths = transitPaths(fetchTransitJson(fromName, fromLon, fromLat, toName, toLon, toLat));
            if (paths == null) return options;

            for (int i = 0; i < paths.length() && options.size() < limit; i++) {
                JSONObject path = paths.getJSONObject(i);
                List<Map<String, Object>> steps = new ArrayList<>();
                JSONArray legs = path.optJSONArray("legs");
                for (int l = 0; legs != null && l < legs.length(); l++) {
                    JSONArray legSteps = legs.getJSONObject(l).optJSONArray("steps");
                    for (int s = 0; legSteps != null && s < legSteps.length(); s++) {
                        steps.add(toStep(legSteps.getJSONObject(s)));
                    }
                }
                Map<String, Object> option = new LinkedHashMap<>();
                option.put("duration", path.optInt("duration"));
                option.put("walkingDuration", path.optInt("walkingDuration"));
                option.put("transferCount", path.optInt("transferCount"));
                option.put("distance", path.optInt("distance"));
                option.put("steps", steps);
                options.add(option);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return options;
    }

    private static Map<String, Object> toStep(JSONObject step) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", step.optString("type"));                 // WALKING, BUS, SUBWAY, TRAIN ...
        m.put("duration", step.optInt("duration"));            // 분
        m.put("distance", step.optInt("distance"));            // m
        m.put("headsign", step.optString("headsign", null));   // 방면

        List<String> routeNames = new ArrayList<>();
        JSONArray routes = step.optJSONArray("routes");
        for (int i = 0; routes != null && i < routes.length(); i++) {
            String name = routes.getJSONObject(i).optString("name", "");
            if (!name.isEmpty()) routeNames.add(name);
        }
        m.put("routes", routeNames);                            // 버스 번호/지하철 노선 (여러 개면 아무거나 타도 됨)

        JSONArray stations = step.optJSONArray("stations");
        if (stations != null && !stations.isEmpty()) {
            m.put("from", stations.getJSONObject(0).optString("name"));
            m.put("to", stations.getJSONObject(stations.length() - 1).optString("name"));
            m.put("stopCount", stations.length() - 1);
        }
        return m;
    }

    // 🚌 대중교통 (duration은 분). 너무 가까우면 네이버가 경로를 주지 않으므로 도보로 대신한다.
    private String getTransitRouteInfo(String fromName, double fromLon, double fromLat,
                                       String toName, double toLon, double toLat) {
        try {
            JSONObject json = fetchTransitJson(fromName, fromLon, fromLat, toName, toLon, toLat);
            JSONArray paths = transitPaths(json);
            if (paths == null || paths.isEmpty()) {
                if ("POINTS_ARE_TOO_CLOSE".equals(json.optString("status"))) {
                    return getWalkRouteInfo(fromName, toName, fromLon, fromLat, toLon, toLat);
                }
                return "대중교통 경로 요청 실패: " + json.optString("status", "경로 없음");
            }

            // 첫 번째 경로가 추천(가장 빠른) 경로. 경로가 1개뿐인 경우도 있으므로 0번을 쓴다.
            JSONObject path = paths.getJSONObject(0);
            return format(path.getInt("duration"), path.getInt("distance"));
        } catch (Exception e) {
            e.printStackTrace();
            return "대중교통 경로 처리 중 예외 발생: " + e.getMessage();
        }
    }

    // 네이버 지도 길찾기 API 호출 (gzip 응답도 처리)
    private JSONObject fetchJson(String url) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .header("accept", "application/json, text/plain, */*")
                .header("accept-encoding", "gzip")
                .header("accept-language", "ko-KR,ko;q=0.8,en-US;q=0.6,en;q=0.4")
                .header("referer", "https://map.naver.com/")
                .header("user-agent", USER_AGENT)
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) {
            throw new IOException("네이버 응답 코드 " + response.statusCode());
        }

        byte[] body = response.body();
        boolean gzipped = response.headers().firstValue("content-encoding").map(v -> v.contains("gzip")).orElse(false);
        try (InputStream in = gzipped ? new GZIPInputStream(new ByteArrayInputStream(body)) : new ByteArrayInputStream(body)) {
            return new JSONObject(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private static String format(int minutes, int distanceMeters) {
        return String.format("%d분 / %skm", minutes, new DecimalFormat("#.##").format(distanceMeters / 1000.0));
    }
}
