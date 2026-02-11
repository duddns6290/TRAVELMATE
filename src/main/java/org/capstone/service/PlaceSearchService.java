package org.capstone.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class PlaceSearchService {

    @Value("${google.places.api.key}")
    private String apiKey;

    private final OkHttpClient client = new OkHttpClient();

    public String searchNearby(double lat, double lng) {
        String url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?" +
                "location=" + lat + "," + lng +
                "&radius=3000&type=lodging" +
                "&language=ko" +
                "&key=" + apiKey;
        return execute(url);
    }

    public String searchText(double lat, double lng, String keyword) {
        String url = "https://maps.googleapis.com/maps/api/place/textsearch/json?" +
                "query=" + URLEncoder.encode(keyword, StandardCharsets.UTF_8) +
                "&location=" + lat + "," + lng +
                "&radius=3000" +
                "&key=" + apiKey +
                "&language=ko";
        return execute(url);
    }

    private String execute(String url) {
        try {
            Request request = new Request.Builder().url(url).build();
            Response response = client.newCall(request).execute();
            return response.body().string();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
