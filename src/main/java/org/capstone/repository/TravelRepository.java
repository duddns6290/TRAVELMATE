package org.capstone.repository;

import org.capstone.entity.userTravel.Travel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface TravelRepository extends JpaRepository<Travel, Long> {
    @Transactional
    @Modifying
    @Query("UPDATE Travel t SET t.travel_image = :image WHERE t.travel_id = :id")
    void updateTravelImageById(Long id, String image);
}
