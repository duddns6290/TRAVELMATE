package org.capstone.controller;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.Auto;
import org.capstone.entity.RestaurantReview;
import org.capstone.service.PlaceSearchService;
import org.capstone.service.RestaurantReviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/restaurant")
@RequiredArgsConstructor
public class RestaurantReviewController {

    private final RestaurantReviewService restaurantReviewService;
    private final PlaceSearchService placeSearchService;

    @GetMapping("/category/google")
    public ResponseEntity<String> searchByText (
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam String keyword
    ) {
        return ResponseEntity.ok(placeSearchService.searchText(lat, lng, keyword));
    }

    //리뷰 조회
    @GetMapping("/review/{id}")
    public ResponseEntity<RestaurantReview> getReviewById(@PathVariable String id) {
        RestaurantReview review = restaurantReviewService.getReviewById(id);
        return ResponseEntity.ok(review);
    }

    //블로그 조회
    @GetMapping("/blog/{id}")
    public ResponseEntity<RestaurantReview> getBlogById(@PathVariable String id) {
        RestaurantReview blog = restaurantReviewService.getBlogById(id);
        return ResponseEntity.ok(blog);
    }

    //가게 정보 조회
    @GetMapping("/info/{id}")
    public ResponseEntity<RestaurantReview> getInfoById(@PathVariable String id) {
        RestaurantReview info = restaurantReviewService.getInfoById(id);
        return ResponseEntity.ok(info);
    }

    //카테고리별 조회
    @GetMapping("/category")
    public ResponseEntity<List<RestaurantReview>> getNearbyByCategory(
            @RequestParam String category,
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "30") int limit,
            @RequestParam(defaultValue = "5") double distanceKm
    ) {
        List<RestaurantReview> nearby = restaurantReviewService.getNearbyByCategory(category, lat, lon, limit, distanceKm);
        return ResponseEntity.ok(nearby);
    }

    // 자동완성 검색
    @GetMapping("/autosearch")
    public ResponseEntity<List<Auto>> autocomplete(@RequestParam String keyword,
                                                     @RequestParam(defaultValue = "10") int limit) {
        List<Auto> suggestions = restaurantReviewService.autocompleteTitles(keyword, limit);
        return ResponseEntity.ok(suggestions);
    }

}
