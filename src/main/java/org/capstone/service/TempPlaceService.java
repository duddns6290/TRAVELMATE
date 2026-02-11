package org.capstone.service;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.TempPlace;
import org.capstone.repository.TempPlaceRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
public class TempPlaceService {

    private final TempPlaceRepository tempPlaceRepository;

    public List<TempPlace> getByTravelId(Long travelId) {
        return tempPlaceRepository.findByTravelId(travelId);
    }

    public TempPlace getById(Long id) {
        return tempPlaceRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("TempPlace not found"));
    }

    public TempPlace create(TempPlace tempPlace) {
        return tempPlaceRepository.save(tempPlace);
    }

    public TempPlace update(Long id, TempPlace updated) {
        TempPlace temp = getById(id);
        temp.setName(updated.getName());
        temp.setAddress(updated.getAddress());
        temp.setImage(updated.getImage());
        temp.setBusinessHour(updated.getBusinessHour());
        temp.setHoliday(updated.getHoliday());
        temp.setLatitude(updated.getLatitude());
        temp.setLongitude(updated.getLongitude());
        temp.setTravelId(updated.getTravelId());
        return tempPlaceRepository.save(temp);
    }

    public void delete(Long id) {
        tempPlaceRepository.deleteById(id);
    }
}
