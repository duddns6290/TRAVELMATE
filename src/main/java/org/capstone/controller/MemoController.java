package org.capstone.controller;

import lombok.RequiredArgsConstructor;
import org.capstone.entity.Memo;
import org.capstone.service.MemoService;
import org.capstone.service.S3FileUploadService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/memos")
@RequiredArgsConstructor
public class MemoController {
    private final MemoService memoService;
    private final S3FileUploadService s3FileUploadService;

    @PostMapping("/place/{placeId}/memo")
    public ResponseEntity<Memo> createByPlace(
            @PathVariable int placeId,
            @RequestPart("memo") Memo memo,
            @RequestPart(value = "image", required = false) MultipartFile imageFile
    ) {
        memo.setPlaceId(placeId);

        if (imageFile != null && !imageFile.isEmpty()) {
            try {
                String imageUrl = s3FileUploadService.uploadFile(
                        "memo/" + System.currentTimeMillis() + "_" + imageFile.getOriginalFilename(),
                        imageFile
                );
                memo.setMemoImage(imageUrl);
            } catch (IOException e) {
                return ResponseEntity.internalServerError().build();
            }
        }

        Memo saved = memoService.createMemo(memo);
        return ResponseEntity.ok(saved);
    }


    @PostMapping("/temp/{tempId}/memo")
    public ResponseEntity<Memo> createByTempId(@PathVariable int tempId, @RequestBody Memo memo) {
        memo.setTempId(tempId);
        return ResponseEntity.ok(memoService.createMemo(memo));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Memo> get(@PathVariable int id) {
        return ResponseEntity.ok(memoService.getMemo(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Memo> update(@PathVariable int id, @RequestBody Memo memo) {
        return ResponseEntity.ok(memoService.updateMemo(id, memo));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable int id) {
        memoService.deleteMemo(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/place/{placeId}")
    public ResponseEntity<List<Memo>> getPlace(@PathVariable int placeId) {
        return ResponseEntity.ok(memoService.getMemosByPlaceId(placeId));
    }

    @GetMapping("/temp/{tempId}")
    public ResponseEntity<List<Memo>> getByTemp(@PathVariable int tempId) {
        return ResponseEntity.ok(memoService.getMemosByTempId(tempId));
    }

}
