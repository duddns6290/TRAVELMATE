package org.capstone.controller;

import org.capstone.entity.Place;
import org.capstone.service.PlaceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.time.LocalTime;

@RestController
@RequestMapping("/place")
public class PlaceController {
    @Autowired
    private final PlaceService placeService;

    public PlaceController(PlaceService placeService) {this.placeService = placeService;}

    //travelID별 조회
    @GetMapping("/travel/{travelId}")
    public ResponseEntity<List<Place>> getPlacesByTravel(@PathVariable Long travelId) {
        return ResponseEntity.ok(placeService.getPlacesByTravelId(travelId));
    }

    //하나의 장소 조회
    @GetMapping("/{placeId}")
    public ResponseEntity<Place> getPlace(@PathVariable int placeId) {
        return ResponseEntity.ok(placeService.getPlace(placeId));
    }

    //장소 등록
    @PostMapping
    public ResponseEntity<Place> createPlace(@RequestBody Place place) {
        return ResponseEntity.ok(placeService.createPlace(place));
    }

    //장소 수정
    @PutMapping("/{placeId}")
    public ResponseEntity<Place> updatePlace(@PathVariable int placeId, @RequestBody Place place) {
        return ResponseEntity.ok(placeService.updatePlace(placeId, place));
    }

    //장소 삭제
    @DeleteMapping("/{placeId}")
    public ResponseEntity<Void> deletePlace(@PathVariable int placeId) {
        placeService.deletePlace(placeId);
        return ResponseEntity.ok().build();
    }

    // 방문 시간 등록 또는 수정
    @PutMapping("/{id}/visiting-time")
    public ResponseEntity<Place> setVisitingTime(
            @PathVariable int id,
            @RequestParam("time") @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime time) {
        return ResponseEntity.ok(placeService.setVisitingTime(id, time));
    }

    // 방문 시간 조회
    @GetMapping("/{id}/visiting-time")
    public ResponseEntity<LocalTime> getVisitingTime(@PathVariable int id) {
        return ResponseEntity.ok(placeService.getVisitingTime(id));
    }

    // 방문 시간 삭제
    @DeleteMapping("/{id}/visiting-time")
    public ResponseEntity<Place> deleteVisitingTime(@PathVariable int id) {
        return ResponseEntity.ok(placeService.deleteVisitingTime(id));
    }

}
