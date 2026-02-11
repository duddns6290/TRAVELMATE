package org.capstone.entity.daySchedule;

import java.util.List;

public class TravelWithPlacesDTO {
    private String travelName;
    private String startDate;
    private String endDate;
    private List<PlaceDTO> places;

    public TravelWithPlacesDTO(String travelName, String startDate, String endDate, List<PlaceDTO> places) {
        this.travelName = travelName;
        this.startDate = startDate;
        this.endDate = endDate;
        this.places = places;
    }

    public String getTravelName() {
        return travelName;
    }

    public String getStartDate() {
        return startDate;
    }

    public String getEndDate() {
        return endDate;
    }

    public List<PlaceDTO> getPlaces() {
        return places;
    }
}
