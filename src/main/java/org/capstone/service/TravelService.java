package org.capstone.service;

import org.capstone.entity.userTravel.*;
import org.capstone.repository.PlaceRepository;
import org.capstone.repository.TravelUserRepository;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.capstone.repository.TravelRepository;
import org.springframework.transaction.annotation.Transactional;
import org.capstone.entity.daySchedule.PlaceDTO;
import org.capstone.entity.Place;
import org.capstone.entity.daySchedule.TravelWithPlacesDTO;


@Service
public class TravelService {

    private final TravelRepository travelRepository;
    private final TravelUserRepository travelUserRepository;
    private final PlaceRepository placeRepository;

    @Autowired
    public TravelService(TravelRepository travelRepository, TravelUserRepository travelUserRepository, PlaceRepository placeRepository) {
        this.travelRepository = travelRepository;
        this.travelUserRepository = travelUserRepository;
        this.placeRepository = placeRepository;
    }

    //여행 id 별 여행 정보 조회
    public List<Travel> getTravelsByIds(List<Long> travelIds) {
        return travelRepository.findAllById(travelIds);
    }

    //사용자 별 여행 id 조회
    public List<Long> getTravelsUser(String userId) {
        return travelUserRepository.findTravelIdsByUserId(userId);
    }


    @Transactional
    public Travel createTravelWithUsers(TravelRequest request) {
        Travel travel = request.getTravel();
        List<UserRoleRequest> users = request.getUsers();
        Travel saved = travelRepository.save(travel);

        for (UserRoleRequest user : users) {
            TravelUser travelUser = new TravelUser();
            travelUser.setId(new TravelUserId((int) saved.getTravel_id(), user.getUserId()));
            travelUser.setRole(user.getRole());

            travelUserRepository.save(travelUser);
        }

        return saved;
    }

    //여행 수정
    public Travel updateTravel(Long id, Travel updatedTravel) {
        Travel travel = travelRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("해당 여행(id=" + id + ")을 찾을 수 없습니다."));

        travel.setTravel_name(updatedTravel.getTravel_name());
        travel.setTravel_start_date(updatedTravel.getTravel_start_date());
        travel.setTravel_end_date(updatedTravel.getTravel_end_date());
        travel.setTravel_period(updatedTravel.getTravel_period());

        return travelRepository.save(travel);
    }

    //사용자별 여행 삭제
    public void deleteTravel(Long id) {
        travelRepository.deleteById(id);
        travelUserRepository.deleteByTravelId(id);
    }

    public void insertImage(Long id, String url) {
        travelRepository.updateTravelImageById(id, url);
    }

    // pdf 여행 정보 조회
    public TravelWithPlacesDTO getTravelWithPlaces(Long travelId) {
        Travel travel = travelRepository.findById(travelId)
                .orElseThrow(() -> new RuntimeException("해당 여행을 찾을 수 없습니다."));

        List<PlaceDTO> placeList = placeRepository.findByTravelId(travelId).stream()
                .sorted(Comparator
                    .comparing(Place::getSelected_day)
                    .thenComparing(Place::getPlace_visiting_time, Comparator.nullsLast(Comparator.naturalOrder()))
                )
                .map(place -> new PlaceDTO(
                        place.getSelected_day(),
                        place.getPlace_visiting_time() != null ? place.getPlace_visiting_time().toString() : null,
                        place.getPlace_name(),
                        place.getPlace_address()
                ))
                .toList();

        return new TravelWithPlacesDTO(
                travel.getTravel_name(),
                travel.getTravel_start_date().toString(),
                travel.getTravel_end_date().toString(),
                placeList
        );
    }
}

