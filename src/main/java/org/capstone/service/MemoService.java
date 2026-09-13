package org.capstone.service;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.Memo;
import org.capstone.repository.MemoRepository;
import org.springframework.stereotype.Service;

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
        memo.setMemoText(updated.getMemoText());
        memo.setMemoImage(updated.getMemoImage());
        memo.setMemoExtraLink(updated.getMemoExtraLink());
        return memoRepository.save(memo);
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
}
