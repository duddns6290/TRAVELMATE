package org.capstone.controller;

import org.capstone.entity.TempPlace;
import org.capstone.service.TempPlaceService;
import org.springframework.beans.factory.annotation.Autowired;
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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        tempPlaceService.delete(id);
        return ResponseEntity.ok().build();
    }


}
