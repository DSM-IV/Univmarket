package com.univmarket.controller;

import com.univmarket.entity.MaterialRequest;
import com.univmarket.entity.MaterialRequestComment;
import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.MaterialRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/material-requests")
@RequiredArgsConstructor
public class MaterialRequestController {

    private final MaterialRequestService materialRequestService;

    /**
     * 자료 요청 목록 (공개)
     */
    @GetMapping
    public ResponseEntity<Page<MaterialRequest>> listRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<MaterialRequest> requests = materialRequestService.listRequests(page, size);
        return ResponseEntity.ok(requests);
    }

    /**
     * 자료 요청 등록
     */
    @PostMapping
    public ResponseEntity<MaterialRequest> submitRequest(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, String> body) {
        MaterialRequest request = materialRequestService.submitRequest(
                principal.getUid(),
                body.get("subject"),
                body.get("professor"),
                body.get("description"),
                body.get("category"));
        return ResponseEntity.ok(request);
    }

    /**
     * "나도 필요해요" 토글
     */
    @PostMapping("/{id}/toggle-need")
    public ResponseEntity<Map<String, Object>> toggleNeed(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id) {
        Map<String, Object> result = materialRequestService.toggleNeed(principal.getUid(), id);
        return ResponseEntity.ok(result);
    }

    /**
     * 자료 요청 상세 + 댓글 (공개)
     */
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getRequest(@PathVariable Long id) {
        Map<String, Object> result = materialRequestService.getRequestWithComments(id);
        return ResponseEntity.ok(result);
    }

    /**
     * 댓글 작성
     */
    @PostMapping("/{id}/comments")
    public ResponseEntity<MaterialRequestComment> addComment(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        MaterialRequestComment comment = materialRequestService.addComment(
                principal.getUid(), id, body.get("content"));
        return ResponseEntity.ok(comment);
    }

    /**
     * 댓글 삭제
     */
    @DeleteMapping("/{id}/comments/{commentId}")
    public ResponseEntity<Map<String, Boolean>> deleteComment(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id,
            @PathVariable Long commentId) {
        materialRequestService.deleteComment(principal.getUid(), id, commentId);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
