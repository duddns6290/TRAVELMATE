package org.capstone.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PlaceLockService {

    private final Map<Integer, String> placeLocks = new ConcurrentHashMap<>();
    // key: placeId, value: userId

    public synchronized boolean tryLock(int placeId, String userId) {
        if (!placeLocks.containsKey(placeId)) {
            placeLocks.put(placeId, userId);
            return true;
        }
        return false;
    }

    public synchronized void unlock(int placeId, String userId) {
        if (userId.equals(placeLocks.get(placeId))) {
            placeLocks.remove(placeId);
        }
    }

    public boolean isLocked(int placeId) {
        return placeLocks.containsKey(placeId);
    }

    public String getLocker(int placeId) {
        return placeLocks.get(placeId);
    }
}
