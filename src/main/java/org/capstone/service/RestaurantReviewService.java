package org.capstone.service;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.Auto;
import org.capstone.entity.RestaurantReview;
import org.capstone.repository.StoreMongoRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.NearQuery;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.data.geo.*;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RestaurantReviewService {

    private final StoreMongoRepository storeMongoRepository;
    private final MongoTemplate mongoTemplate;

    // 리뷰 조회
    public RestaurantReview getReviewById(String id) {
        return storeMongoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("리뷰 없음"));
    }

    //가게정보 조회
    public RestaurantReview getInfoById(String id) {
        return storeMongoRepository.findInfoById(id);
    }

    //블로그 리뷰 조회
    public RestaurantReview getBlogById(String id) {
        return storeMongoRepository.findBlogById(id);
    }

    // 카테고리별 가게 조회 -> 현재 가능 카테고리 (cafe, restaurant)
    public List<RestaurantReview> getNearbyByCategory(String category, double lat, double lon, int limit, double maxDistanceKm) {
        Point center = new Point(lon, lat);
        Distance maxDist = new Distance(maxDistanceKm, Metrics.KILOMETERS);

        NearQuery query = NearQuery.near(center)
                .spherical(true)
                .maxDistance(maxDist)
                .query(org.springframework.data.mongodb.core.query.Query.query(
                        org.springframework.data.mongodb.core.query.Criteria.where("category").is(category)
                ))
                .limit(limit);

        GeoResults<RestaurantReview> results = mongoTemplate.geoNear(query, RestaurantReview.class, "restaurant_reviews");



        return results.getContent()
                .stream()
                .map(GeoResult::getContent)
                .collect(Collectors.toList());
    }

    public List<Auto> autocompleteTitles(String keyword, int limit) {
        String regex = "^" + keyword;
        Pageable pageable = PageRequest.of(0, limit);
        return storeMongoRepository.findByTitleRegex(regex, pageable);
    }


}


