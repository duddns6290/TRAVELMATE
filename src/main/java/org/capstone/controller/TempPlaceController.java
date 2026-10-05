package org.capstone.controller;

import org.capstone.entity.Memo;
import org.capstone.entity.TempPlace;
import org.capstone.service.TempPlaceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/tempplace")
public class TempPlaceController {

    @Autowired
    private TempPlaceService tempPlaceService;

    @GetMapping("/travel/{travelId}")
    public ResponseEntity<List<TempPlace>> getByTravel(@PathVariable Long travelId) {
        return ResponseEntity.ok(tempPlaceService.getByTravelId(travelId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TempPlace> getById(@PathVariable Long id) {
        return ResponseEntity.ok(tempPlaceService.getById(id));
    }

    @PostMapping
    public ResponseEntity<TempPlace> create(@RequestBody TempPlace tempPlace) {
        return ResponseEntity.ok(tempPlaceService.create(tempPlace));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TempPlace> update(@PathVariable Long id, @RequestBody TempPlace tempPlace) {
        return ResponseEntity.ok(tempPlaceService.update(id, tempPlace));
    }

    // 스크랩 장소를 타임테이블에 등록한 뒤 호출: 메모를 새 장소(placeId)로 옮기고 스크랩은 삭제한다.
    // 옮겨진 메모 목록을 돌려준다.
    @PostMapping("/{id}/move-to-place")
    public ResponseEntity<List<Memo>> moveToPlace(@PathVariable Long id, @RequestParam int placeId) {
        return ResponseEntity.ok(tempPlaceService.moveToPlace(id, placeId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestParam(required = false) String userId) {
        // 본인이 스크랩한 장소만 삭제 가능 (작성자 정보가 없는 예전 스크랩은 누구나 삭제 가능)
        TempPlace existing = tempPlaceService.getById(id);
        if (existing != null && existing.getUserId() != null && !existing.getUserId().equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        tempPlaceService.delete(id);
        return ResponseEntity.ok().build();
    }


}
