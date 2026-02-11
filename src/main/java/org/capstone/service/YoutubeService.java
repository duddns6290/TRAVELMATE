package org.capstone.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.http.ResponseEntity;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class YoutubeService {

    @Value("${youtube.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    public List<Map<String, String>> search(String keyword, int maxResults) {
        String searchUrl = UriComponentsBuilder.fromHttpUrl("https://www.googleapis.com/youtube/v3/search")
                .queryParam("part", "snippet")
                .queryParam("q", keyword)
                .queryParam("type", "video")
                .queryParam("videoDuration", "medium")
                .queryParam("order", "viewCount")
                .queryParam("regionCode", "KR")
                .queryParam("maxResults", maxResults)
                .queryParam("key", apiKey)
                .build().toUriString();

        ResponseEntity<Map> response = restTemplate.getForEntity(searchUrl, Map.class);
        List<Map<String, Object>> items = (List<Map<String, Object>>) response.getBody().get("items");

        // videoId 목록 수집
        List<String> videoIds = items.stream()
                .map(item -> ((Map<String, Object>) item.get("id")).get("videoId").toString())
                .collect(Collectors.toList());

        // video 정보 상세 조회
        String detailUrl = UriComponentsBuilder.fromHttpUrl("https://www.googleapis.com/youtube/v3/videos")
                .queryParam("part", "snippet,statistics")
                .queryParam("id", String.join(",", videoIds))
                .queryParam("key", apiKey)
                .build().toUriString();

        ResponseEntity<Map> detailResponse = restTemplate.getForEntity(detailUrl, Map.class);
        List<Map<String, Object>> detailItems = (List<Map<String, Object>>) detailResponse.getBody().get("items");

        List<Map<String, String>> result = new ArrayList<>();

        for (Map<String, Object> item : detailItems) {
            Map<String, Object> snippet = (Map<String, Object>) item.get("snippet");
            Map<String, Object> statistics = (Map<String, Object>) item.get("statistics");
            Map<String, Object> thumbnails = (Map<String, Object>) snippet.get("thumbnails");
            Map<String, Object> medium = (Map<String, Object>) thumbnails.get("medium");

            Map<String, String> video = new HashMap<>();
            video.put("title", (String) snippet.get("title"));
            video.put("thumbnail", (String) medium.get("url"));
            video.put("url", "https://www.youtube.com/watch?v=" + item.get("id"));
            video.put("publishedAt", (String) snippet.get("publishedAt"));
            video.put("channelTitle", (String) snippet.get("channelTitle"));
            video.put("viewCount", String.valueOf(statistics.get("viewCount")));

            result.add(video);
        }
        return result;
    }
}
