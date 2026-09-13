package org.capstone.repository;

import org.capstone.entity.MoveTime;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MoveTimeRepository extends JpaRepository<MoveTime, Long> {
    List<MoveTime> findByDeparturePlace(Integer departurePlace);
}