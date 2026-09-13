package org.capstone.service;

public class TitleLocationDto {
    private String id;
    private String title;
    private double latitude;
    private double longitude;

    public TitleLocationDto(String id, String title, double latitude, double longitude) {
        this.id = id;
        this.title = title;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    // Getters/Setters 또는 Lombok @Data 사용 가능
}
