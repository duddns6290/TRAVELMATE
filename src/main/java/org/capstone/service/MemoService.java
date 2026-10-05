package org.capstone.service;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.Memo;
import org.capstone.repository.MemoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MemoService {

    private final MemoRepository memoRepository;

    public Memo createMemo(Memo memo) {
        return memoRepository.save(memo);
    }

    public Memo updateMemo(int id, Memo updated) {
        Memo memo = memoRepository.findById(id)
            .orElseThrow(() -> new NoSuchElementException("메모 없음"));
        if (updated.getMemoTitle() != null) memo.setMemoTitle(updated.getMemoTitle());
        memo.setMemoText(updated.getMemoText());
        // 이미지는 새로 보낸 경우에만 교체
        if (updated.getMemoImage() != null) memo.setMemoImage(updated.getMemoImage());
        memo.setMemoExtraLink(updated.getMemoExtraLink());
        return memoRepository.save(memo);
    }

    // 한 장소에 사용자당 메모는 1개만
    public boolean hasMemo(int placeId, String userId) {
        return userId != null && memoRepository.existsByPlaceIdAndUserId(placeId, userId);
    }

    // 스크랩 장소도 사용자당 메모 1개
    public boolean hasTempMemo(int tempId, String userId) {
        return userId != null && memoRepository.existsByTempIdAndUserId(tempId, userId);
    }

    public void deleteMemo(int id) {
        memoRepository.deleteById(id);
    }

    public Memo getMemo(int id) {
        return memoRepository.findById(id).orElse(null);
    }

    public List<Memo> getMemosByPlaceId(int placeId) {
        return memoRepository.findByPlaceId(placeId);
    }

    public List<Memo> getMemosByTempId(int tempId) {
        return memoRepository.findByTempId(tempId);
    }

    // 스크랩 장소의 메모를 타임테이블 장소로 옮긴다
    @Transactional
    public List<Memo> moveTempMemosToPlace(int tempId, int placeId) {
        List<Memo> memos = memoRepository.findByTempId(tempId);
        for (Memo memo : memos) {
            memo.setTempId(null);
            memo.setPlaceId(placeId);
        }
        return memoRepository.saveAll(memos);
    }
}
