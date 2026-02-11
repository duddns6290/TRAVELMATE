package org.capstone.repository;

import org.capstone.entity.Auto;
import org.capstone.entity.RestaurantReview;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StoreMongoRepository extends MongoRepository<RestaurantReview, String> {
    @Query(value = "{ '_id' : :#{#id} }", fields = "{ 'blogReviews' : 1 }")
    RestaurantReview findBlogById(@Param("id") String id);

    @Query(value = "{ '_id' : :#{#id} }",
            fields = "{ 'Category' : 1, 'Keyword' : 1, 'Title' : 1, 'title_img' : 1, 'Address' : 1, 'number' : 1, 'service' : 1, 'lat' : 1, 'lon' : 1, 'wk' : 1 }"
    )
    RestaurantReview findInfoById(@Param("id") String id);

    @Query(value = "{ '_id' : :#{#id} }", fields = "{ 'reviews': 1, 'review_dates': 1, 'review_nicknames': 1, 'review_photos_list': 1 }")
    Optional<RestaurantReview> findById(@Param("id") String id);

    @Query("{ 'Title': { $regex: ?0, $options: 'i' } }")
    List<Auto> findByTitleRegex(String regex, Pageable pageable);

}
