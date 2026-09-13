package org.capstone.entity.daySchedule;

public class PlaceDTO {
    private int selectedDay;
    private String placeVisitingTime;
    private String placeName;
    private String placeAddress;

    public PlaceDTO(int selectedDay, String visitingTime, String name, String address) {
        this.selectedDay = selectedDay;
        this.placeVisitingTime = visitingTime;
        this.placeName = name;
        this.placeAddress = address;
    }

    public int getSelectedDay() { return selectedDay; }
    public String getPlaceVisitingTime() { return placeVisitingTime; }
    public String getPlaceName() { return placeName; }
    public String getPlaceAddress() { return placeAddress; }
}

