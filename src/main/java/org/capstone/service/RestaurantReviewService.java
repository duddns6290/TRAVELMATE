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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
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

    // 지도 검색창: 이름에 keyword가 들어간 가게를 (lat, lon)에서 가까운 순으로. 주변(radiusKm)에 없으면 전국에서 찾는다.
    public List<Map<String, Object>> searchNearby(String keyword, double lat, double lon, int limit, double radiusKm) {
        Criteria byName = Criteria.where("title")
                .regex(Pattern.compile(Pattern.quote(keyword.trim()), Pattern.CASE_INSENSITIVE));

        NearQuery near = NearQuery.near(new Point(lon, lat))
                .spherical(true)
                .inKilometers()
                .maxDistance(new Distance(radiusKm, Metrics.KILOMETERS))
                .query(Query.query(byName))
                .limit(limit);

        List<Map<String, Object>> results = mongoTemplate.geoNear(near, RestaurantReview.class, "restaurant_reviews")
                .getContent().stream()
                .map(r -> toSearchResult(r.getContent(), r.getDistance().getValue()))
                .collect(Collectors.toList());

        if (results.isEmpty()) {
            Query anywhere = Query.query(byName).limit(limit);
            results = mongoTemplate.find(anywhere, RestaurantReview.class, "restaurant_reviews").stream()
                    .map(r -> toSearchResult(r, null))
                    .collect(Collectors.toList());
        }
        return results;
    }

    private Map<String, Object> toSearchResult(RestaurantReview r, Double distanceKm) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("title", r.getTitle());
        m.put("address", r.getAddress());
        m.put("titleImg", r.getTitleImg());
        m.put("category", r.getCategory());
        m.put("lat", r.getLat());
        m.put("lon", r.getLon());
        m.put("distanceKm", distanceKm);
        return m;
    }

    public List<Auto> autocompleteTitles(String keyword, int limit) {
        String regex = "^" + keyword;
        Pageable pageable = PageRequest.of(0, limit);
        return storeMongoRepository.findByTitleRegex(regex, pageable);
    }


}


