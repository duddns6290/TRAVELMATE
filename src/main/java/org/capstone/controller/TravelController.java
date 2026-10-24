package org.capstone.controller;

import org.capstone.entity.Role;
import org.capstone.entity.userTravel.TravelRequest;
import org.capstone.entity.userTravel.UserRoleRequest;
import org.capstone.repository.TravelUserRepository;
import org.capstone.service.S3FileUploadService;
import org.capstone.service.TravelUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.capstone.service.TravelService;
import org.capstone.entity.userTravel.Travel;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/travel")
public class TravelController {

    private final TravelService travelService;
    private final S3FileUploadService fileUploadService;

    @Autowired
    public TravelController(TravelService travelService, S3FileUploadService fileUploadService) {
        this.travelService = travelService;
        this.fileUploadService = fileUploadService;
    }
    //Travel 조회
    @GetMapping("/{userId}")
    @PreAuthorize("#userId == authentication.name") // 본인 여행 목록만
    public List<Travel> getAllTravels(@PathVariable String userId) {
        List<Long> travelsId = travelService.getTravelsUser(userId);
        return travelService.getTravelsByIds(travelsId);
    }

    //여행자별 등록
    @PostMapping()
    public ResponseEntity<Travel> createTravel(
            @RequestPart("travel") Travel travel,
            @RequestPart("users") List<UserRoleRequest> users,
            @RequestPart(value = "image", required = false) MultipartFile imageFile,
            Authentication authentication
    ) {
        // 호스트는 항상 로그인한 사용자. 클라이언트가 보낸 목록으로 다른 사람을 호스트로 만들 수 없다.
        UserRoleRequest host = new UserRoleRequest();
        host.setUserId(authentication.getName());
        host.setRole(Role.HOST);
        List<UserRoleRequest> members = new ArrayList<>(List.of(host));
        users.stream()
                .filter(u -> !host.getUserId().equals(u.getUserId()) && u.getRole() != Role.HOST)
                .forEach(members::add);

        try {
            if (imageFile != null && !imageFile.isEmpty()) {
                String imageUrl = fileUploadService.uploadFile(
                        "travel/" + System.currentTimeMillis() + "_" + imageFile.getOriginalFilename(),
                        imageFile
                );
                travel.setTravel_image(imageUrl);
            }

            TravelRequest request = new TravelRequest(travel, members);  // 수동으로 조립
            Travel savedTravel = travelService.createTravelWithUsers(request);
            return ResponseEntity.ok(savedTravel);

        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }


    //수정
    @PutMapping("/{id}")
    @PreAuthorize("@travelAccess.isHost(authentication, #id)")
    public ResponseEntity<Travel> updateTravel(@PathVariable Long id, @RequestBody Travel travel) {
        Travel updated = travelService.updateTravel(id, travel);
        return ResponseEntity.ok(updated);
    }

    //삭제
    @DeleteMapping("/{id}")
    @PreAuthorize("@travelAccess.isHost(authentication, #id)")
    public ResponseEntity<Void> deleteTravel(@PathVariable Long id) {
        travelService.deleteTravel(id);
        return ResponseEntity.noContent().build();
    }

}


