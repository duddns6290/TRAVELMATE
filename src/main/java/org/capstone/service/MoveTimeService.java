package org.capstone.service;

import org.capstone.entity.MoveTime;
import org.capstone.repository.MoveTimeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MoveTimeService {

    @Autowired
    private MoveTimeRepository repository;

    public MoveTime create(MoveTime moveTime) {
        return repository.save(moveTime);
    }

    public MoveTime getById(Long id) {
        return repository.findById(id).orElseThrow();
    }

    public List<MoveTime> getAll() {
        return repository.findAll();
    }

    public MoveTime update(Long id, MoveTime updated) {
        MoveTime existing = getById(id);
        existing.setType(updated.getType());
        existing.setTime(updated.getTime());
        existing.setDistance(updated.getDistance());
        existing.setDeparturePlace(updated.getDeparturePlace());
        existing.setUrl(updated.getUrl());
        return repository.save(existing);
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }

    public List<MoveTime> getByDeparturePlace(Integer departurePlace) {
        return repository.findByDeparturePlace(departurePlace);
    }

}
