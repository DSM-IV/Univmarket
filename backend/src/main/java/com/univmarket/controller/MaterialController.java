package com.univmarket.controller;

import com.univmarket.entity.Material;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.MaterialRepository;
import com.univmarket.repository.ReviewRepository;
import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.FileService;
import com.univmarket.service.MaterialService;
import com.univmarket.service.MaterialScanService;
import com.univmarket.service.PurchaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MaterialController {

    private final MaterialRepository materialRepository;
    private final ReviewRepository reviewRepository;
    private final FileService fileService;
    private final PurchaseService purchaseService;
    private final MaterialService materialService;
    private final MaterialScanService materialScanService;

    /**
     * 자료 목록 (공개)
     */
    @GetMapping("/materials")
    public ResponseEntity<List<Material>> listMaterials(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer limit) {
        int effectiveSize = Math.min(
                (limit != null ? limit : (size != null ? size : 20)),
                50);
        PageRequest pageRequest = PageRequest.of(page, Math.max(effectiveSize, 1),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(
                materialRepository.findByHiddenFalseAndCopyrightDeletedFalse(pageRequest).getContent());
    }

    /**
     * 자료 상세 (공개)
     */
    @GetMapping("/materials/{id}")
    public ResponseEntity<Material> getMaterial(@PathVariable Long id) {
        Material material = materialRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("자료를 찾을 수 없습니다."));
        if (material.isHidden() || material.isCopyrightDeleted()) {
            throw ApiException.notFound("자료를 찾을 수 없습니다.");
        }
        return ResponseEntity.ok(material);
    }

    /**
     * 자료 등록 (인증 필요)
     */
    @PostMapping("/materials")
    public ResponseEntity<Map<String, Object>> createMaterial(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        Material created = materialService.createMaterial(principal.getUid(), body);
        return ResponseEntity.ok(Map.of("id", created.getId()));
    }

    /**
     * 내 자료 부분 수정
     */
    @PatchMapping("/materials/{id}")
    public ResponseEntity<Material> updateMyMaterial(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        Material updated = materialService.updateMyMaterial(principal.getUid(), id, body);
        return ResponseEntity.ok(updated);
    }

    /**
     * 내 자료 삭제
     */
    @DeleteMapping("/materials/{id}")
    public ResponseEntity<Map<String, Boolean>> deleteMyMaterial(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id) {
        materialService.deleteMyMaterial(principal.getUid(), id);
        return ResponseEntity.ok(Map.of("success", true));
    }

    /**
     * 자료별 리뷰 목록 (공개)
     */
    @GetMapping("/materials/{id}/reviews")
    public ResponseEntity<List<com.univmarket.entity.Review>> listReviewsForMaterial(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(
                reviewRepository.findByMaterialIdOrderByCreatedAtDesc(
                        id, PageRequest.of(page, Math.min(Math.max(size, 1), 50))).getContent());
    }

    /**
     * 바이러스 검사 트리거 (비동기)
     */
    @PostMapping("/materials/{id}/scan")
    public ResponseEntity<Map<String, String>> scanMaterial(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id) {
        materialScanService.startScan(principal.getUid(), id);
        return ResponseEntity.accepted().body(Map.of("status", "scanning"));
    }

    /**
     * 업로드 URL 발급 (인증 필요)
     */
    @PostMapping("/materials/upload-url")
    public ResponseEntity<Map<String, String>> getUploadUrl(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @RequestBody Map<String, Object> body) {
        String fileName = (String) body.get("fileName");
        String contentType = (String) body.get("contentType");
        Number fileSize = (Number) body.get("fileSize");

        if (fileName == null || contentType == null || fileSize == null) {
            throw ApiException.badRequest("파일 정보가 누락되었습니다.");
        }

        Map<String, String> result = fileService.generateUploadUrl(
                principal.getUid(), fileName, contentType, fileSize.longValue());
        return ResponseEntity.ok(result);
    }

    /**
     * 자료 구매 (인증 필요)
     */
    @PostMapping("/materials/{id}/purchase")
    public ResponseEntity<Map<String, Boolean>> purchase(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id) {
        purchaseService.purchaseMaterial(principal.getUid(), id);
        return ResponseEntity.ok(Map.of("success", true));
    }

    /**
     * 다운로드 URL 발급 (구매자 또는 작성자만)
     * body.fileKey 가 있으면 해당 파일, 없으면 대표 파일.
     */
    @PostMapping("/materials/{id}/download-url")
    public ResponseEntity<Map<String, String>> getDownloadUrl(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body) {
        String fileKey = body != null ? (String) body.get("fileKey") : null;
        String downloadUrl = purchaseService.issueDownloadUrl(principal.getUid(), id, fileKey, fileService);
        return ResponseEntity.ok(Map.of("downloadUrl", downloadUrl));
    }

    /**
     * 환불 (인증 필요)
     */
    @PostMapping("/purchases/{purchaseId}/refund")
    public ResponseEntity<Map<String, Boolean>> refund(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long purchaseId) {
        purchaseService.refundPurchase(principal.getUid(), purchaseId);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
