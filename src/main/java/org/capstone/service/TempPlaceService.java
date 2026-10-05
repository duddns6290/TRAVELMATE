package org.capstone.service;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.Memo;
import org.capstone.entity.TempPlace;
import org.capstone.repository.TempPlaceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
public class TempPlaceService {

    private final TempPlaceRepository tempPlaceRepository;
    private final MemoService memoService;

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

    // 스크랩을 타임테이블 장소(placeId)로 옮긴다: 메모를 이관하고 스크랩은 삭제. 둘 중 하나만 되는 일이 없도록 한 트랜잭션.
    @Transactional
    public List<Memo> moveToPlace(Long tempId, int placeId) {
        List<Memo> moved = memoService.moveTempMemosToPlace(tempId.intValue(), placeId);
        tempPlaceRepository.deleteById(tempId);
        return moved;
    }
}
