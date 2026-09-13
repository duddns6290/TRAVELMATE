package org.capstone.repository;

import org.capstone.entity.TempPlace;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TempPlaceRepository extends JpaRepository<TempPlace, Long> {
    List<TempPlace> findByTravelId(Long travelId);
}