package org.capstone.repository;

import org.capstone.entity.Memo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MemoRepository extends JpaRepository<Memo, Integer> {
    List<Memo> findByPlaceId(int placeId);
    List<Memo> findByTempId(int tempId );
    boolean existsByPlaceIdAndUserId(int placeId, String userId);
    boolean existsByTempIdAndUserId(int tempId, String userId);
}
