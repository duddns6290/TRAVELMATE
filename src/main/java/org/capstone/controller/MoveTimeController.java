package org.capstone.controller;

import org.capstone.entity.MoveTime;
import org.capstone.service.MoveTimeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/movetime")
public class MoveTimeController {

    @Autowired
    private MoveTimeService service;

    @PostMapping
    public MoveTime create(@RequestBody MoveTime moveTime) {
        return service.create(moveTime);
    }

    @GetMapping("/{id}")
    public MoveTime get(@PathVariable Long id) {
        return service.getById(id);
    }

    @GetMapping
    public List<MoveTime> getAll() {
        return service.getAll();
    }

    @PutMapping("/{id}")
    public MoveTime update(@PathVariable Long id, @RequestBody MoveTime moveTime) {
        return service.update(id, moveTime);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    @GetMapping("/departure/{departurePlace}")
    public List<MoveTime> getByDeparturePlace(@PathVariable Integer departurePlace) {
        return service.getByDeparturePlace(departurePlace);
    }



}

