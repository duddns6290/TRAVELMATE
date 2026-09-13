package org.capstone.entity;

public class PlaceDTO {
    private String placeName;
    private String visitingTime;

    public PlaceDTO(String placeName, String visitingTime) {
        this.placeName = placeName;
        this.visitingTime = visitingTime;
    }

    public String getPlaceName() {
        return placeName;
    }

    public String getVisitingTime() {
        return visitingTime;
    }
}
