package org.capstone.controller;

import lombok.RequiredArgsConstructor;
import org.capstone.service.YoutubeService;
import org.capstone.entity.YoutubeDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/youtube")
public class YoutubeController {

    private final YoutubeService youtubeService;

    @GetMapping("/search")
    public ResponseEntity<List<YoutubeDTO>> searchVideos(@RequestParam String keyword) {
        List<Map<String, String>> rawResults = youtubeService.search(keyword, 15);

        List<YoutubeDTO> results = rawResults.stream()
                .map(map -> new YoutubeDTO(
                        map.get("title"),
                        map.get("thumbnail"),
                        map.get("url"),
                        map.get("publishedAt"),
                        map.get("channelTitle"),
                        map.get("viewCount")
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(results);
    }
}
