package org.capstone.service;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.Place;
import org.capstone.repository.PlaceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
public class PlaceService {

    @Autowired
    private final PlaceRepository placeRepository;

    //여행 별 place 조회
    public List<Place> getPlacesByTravelId(Long travelId) {
        return placeRepository.findByTravelId(travelId);
    }

    //특정 한 장소 조회
    public Place getPlace(int placeId) {
        return placeRepository.findById(placeId)
                .orElseThrow(() -> new NoSuchElementException("Place not found"));
    }

    //장소 추가
    public Place createPlace(Place place) {
        return placeRepository.save(place);
    }

    //장소 수정
    public Place updatePlace(int placeId, Place updated) {
        Place place = getPlace(placeId);

        place.setPlace_name(updated.getPlace_name());
        place.setPlace_address(updated.getPlace_address());
        place.setPlace_image(updated.getPlace_image());
        place.setPlace_business_hour(updated.getPlace_business_hour());
        place.setPlace_holiday(updated.getPlace_holiday());
        place.setPlace_stay_time(updated.getPlace_stay_time());
        place.setNext_place_id(updated.getNext_place_id());
        place.setPlace_visiting_time(updated.getPlace_visiting_time());
        place.setLatitude(updated.getLatitude());
        place.setLongitude(updated.getLongitude());
        place.setTravelId(updated.getTravelId());
        place.setSelected_day(updated.getSelected_day());
        place.setMongo(updated.getMongo());

        return placeRepository.save(place);
    }

    //장소 삭제
    public void deletePlace(int placeId) {
        placeRepository.deleteById(placeId);
    }

    // 특정 장소 조회
    public Place getPlaceById(int id) {
        return placeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("조회된 정보가 없습니다."));
    }

    // 방문 시간 등록/수정
    public Place setVisitingTime(int id, LocalTime visitingTime) {
        Place place = getPlaceById(id);
        place.setPlace_visiting_time(visitingTime);
        return placeRepository.save(place);
    }

    // 방문 시간 조회
    public LocalTime getVisitingTime(int id){
        return getPlaceById(id).getPlace_visiting_time();
    }


    // 방문 시간 삭제
    public Place deleteVisitingTime(int id) {
        Place place = getPlaceById(id);
        place.setPlace_visiting_time(null);
        return placeRepository.save(place);
    }
}
