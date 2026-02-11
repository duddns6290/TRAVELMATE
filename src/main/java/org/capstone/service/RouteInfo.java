package org.capstone.service;

import org.json.JSONObject;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import io.github.bonigarcia.wdm.WebDriverManager;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
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
import java.util.zip.GZIPInputStream;

@Service
public class RouteInfo {

    public String getRouteUrl(String fromName, double fromLon, double fromLat,
                              String toName, double toLon, double toLat, String mode) {
        return RouteURL.buildRouteUrl(fromName, fromLon, fromLat, toName, toLon, toLat, mode);
    }

    public String getRouteEstimatedTime(String fromName, double fromLon, double fromLat,
                                        String toName, double toLon, double toLat, String mode) {
        return switch (mode) {
            case "walk" -> getWalkRouteInfo(fromName, toName, fromLon, fromLat,  toLon, toLat);
            case "transmit" -> getTransitRouteInfo(fromName, fromLon, fromLat, toName, toLon, toLat);
            default -> "지원하지 않는 모드입니다.";
        };
    }

    public String getWalkRouteInfo(String startName, String endName,
                                   double startLon, double startLat,
                                   double endLon, double endLat) {
        try {
            String encodedStart = URLEncoder.encode(startName, StandardCharsets.UTF_8);
            String encodedEnd = URLEncoder.encode(endName, StandardCharsets.UTF_8);

            String url = "https://map.naver.com/p/api/directions/walk"
                    + "?o=reco,wide,flat"
                    + "&l=" + startLon + "," + startLat + ",placeid%3D0,name%3D" + encodedStart + "%3B"
                    + endLon + "," + endLat + ",placeid%3D0,name%3D" + encodedEnd
                    + "&e=1";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("accept", "application/json, text/plain, */*")
                    .header("accept-encoding", "gzip, deflate, br, zstd")
                    .header("accept-language", "ko-KR,ko;q=0.8,en-US;q=0.6,en;q=0.4")
                    .header("cache-control", "no-cache")
                    .header("referer", "https://map.naver.com/")
                    .header("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36")
                    .build();

            HttpResponse<java.io.InputStream> response = HttpClient.newHttpClient()
                    .send(request, HttpResponse.BodyHandlers.ofInputStream());

            if (response.statusCode() == 200) {
                try (GZIPInputStream gis = new GZIPInputStream(response.body());
                     BufferedReader reader = new BufferedReader(new InputStreamReader(gis, StandardCharsets.UTF_8))) {

                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }

                    JSONObject json = new JSONObject(sb.toString());
                    JSONObject summary = json.getJSONArray("routes").getJSONObject(0).getJSONObject("summary");

                    int distance = summary.getInt("distance");
                    int duration = summary.getInt("duration");
                    double distanceKm = distance / 1000.0;
                    DecimalFormat df = new DecimalFormat("#.##"); // 소수점 둘째 자리까지
                    String formattedDistance = df.format(distanceKm);
                    return String.format("%d분 / %skm", duration / 60, formattedDistance);
                }
            } else {
                return "도보 경로 요청 실패: " + response.statusCode();
            }
        } catch (Exception e) {
            e.printStackTrace();
            return "도보 경로 처리 중 예외 발생: " + e.getMessage();
        }
    }


    private String getTransitRouteInfo(String fromName, double fromLon, double fromLat,
                                       String toName, double toLon, double toLat) {
        try {
            String encodedStart = java.net.URLEncoder.encode(fromName, "UTF-8");
            String encodedEnd = java.net.URLEncoder.encode(toName, "UTF-8");

            String departureTime = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);

            String apiUrl = "https://map.naver.com/p/api/directions/pubtrans"
                    + "?start=" + fromLon + "," + fromLat + ",placeid%3D0,name%3D" + encodedStart
                    + "&goal=" + toLon + "," + toLat + ",placeid%3D0,name%3D" + encodedEnd
                    + "&crs=EPSG:4326&includeDetailOperation=true&lang=ko"
                    + "&supportFerry=true&mode=TIME&departureTime=" + departureTime;

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .header("accept", "application/json, text/plain, */*")
                    .header("accept-encoding", "gzip")
                    .header("accept-language", "ko-KR,ko;q=0.8,en-US;q=0.6,en;q=0.4")
                    .header("cache-control", "no-cache")
                    .header("referer", "https://map.naver.com/")
                    .header("cookie", "NNB=MENMWLT4BRHGM; ASID=76eb556c000001908e23b1de0000004c; NFS=2; _fbp=fb.1.1739973292127.770066403157352417; _ga_J5CZVNJNQP=GS1.1.1739973292.1.0.1739973292.0.0.0; _ga=GA1.1.1443063234.1739973292; NAC=Df1lCIhAxJxMB; NACT=1; SRT30=1749002612; SRT5=1749003799; BUC=ERCcJ8Oz_tR6UZ_OOP5Q0zZK5Ox2IiQr2JRvMD7oUq8=") // 반드시 유효한 전체 쿠키로 교체 필요
                    .header("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36")
                    .build();

            HttpResponse<byte[]> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofByteArray());

            if (response.statusCode() == 200) {
                InputStream gzipStream = new GZIPInputStream(new ByteArrayInputStream(response.body()));
                BufferedReader reader = new BufferedReader(new InputStreamReader(gzipStream));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }

                JSONObject json = new JSONObject(sb.toString());
                JSONObject path = json.getJSONArray("paths").getJSONObject(1);

                String depTime = path.getString("departureTime");
                String arrTime = path.getString("arrivalTime");
                int duration = path.getInt("duration");
                int distance = path.getInt("distance");
                double distanceKm = distance / 1000.0;
                DecimalFormat df = new DecimalFormat("#.##");
                String formattedDistance = df.format(distanceKm);
                return String.format("%d분 / %skm", duration, formattedDistance);

            } else {
                return "대중교통 경로 요청 실패: " + response.statusCode();
            }
        } catch (Exception e) {
            e.printStackTrace();
            return "대중교통 경로 처리 중 예외 발생: " + e.getMessage();
        }
    }


}
