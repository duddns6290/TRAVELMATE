package org.capstone.repository;

import org.capstone.entity.Place;
import org.springframework.data.jpa.repository.JpaRepository;
import org.capstone.entity.Place;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PlaceRepository extends JpaRepository<Place, Integer> {
    List<Place> findByTravelId(Long travelId);
    @Query("SELECT p FROM Place p WHERE p.travelId = :travelId")
    List<Place> findByTravel(@Param("travelId") Long travelId);
}
