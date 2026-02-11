package org.capstone.repository;

import org.capstone.entity.userTravel.TravelUserId;
import org.capstone.entity.userTravel.TravelUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface TravelUserRepository extends JpaRepository<TravelUser, TravelUserId> {
  @Query("SELECT tu.id.travelId FROM TravelUser tu WHERE tu.id.userId = :userId")
  List<Long> findTravelIdsByUserId(@Param("userId") String userId);

  @Modifying
  @Transactional
  @Query("DELETE FROM TravelUser tu WHERE tu.id.travelId = :travelId")
  void deleteByTravelId(@Param("travelId") Long travelId);
  List<TravelUser> findAllByIdUserId(String userId);
  List<TravelUser> findByIdTravelId(int travelId);
  boolean existsByIdUserIdAndIdTravelId(String userId, Integer travelId);
  }

