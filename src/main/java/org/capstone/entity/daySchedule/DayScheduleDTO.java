package org.capstone.entity.daySchedule;

import java.util.List;

public class DayScheduleDTO {
    private int day;
    private String dateString;
    private List<PlaceDTO> places;

    public DayScheduleDTO(int day, String dateString, List<PlaceDTO> places) {
        this.day = day;
        this.dateString = dateString;
        this.places = places;
    }

    public int getDay() {
        return day;
    }

    public String getDateString() {
        return dateString;
    }

    public List<PlaceDTO> getPlaces() {
        return places;
    }
}

