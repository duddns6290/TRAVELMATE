package org.capstone.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
@Document(collection = "restaurant_reviews")
public class RestaurantReview {

    @Id
    private String id;

    @Field("Category")
    private String category;

    @Field("Keyword")
    private String keyword;

    @Field("Title")
    private String title;

    @Field("title_img")
    private String titleImg;

    @Field("Address")
    private String address;

    @Field("number")
    private String number;

    @Field("service")
    private String service;

    @Field("lat")
    private String lat;

    @Field("lon")
    private String lon;

    @Field("wk")
    private String wk;

    @Field("reviews")
    private List<String> reviews;

    @Field("review_dates")
    private List<String> reviewDates;

    @Field("review_nicknames")
    private List<String> reviewNicknames;

    @Field("review_photos_list")
    private List<String> reviewPhotosList;

    @Field("blog_reviews")
    private List<String> blogReviews;

}
