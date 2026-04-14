package com.univmarket.controller;

import com.univmarket.entity.Material;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.MaterialRepository;
import com.univmarket.security.FirebaseUserPrincipal;
import com.univmarket.service.FileService;
import com.univmarket.service.MaterialService;
import com.univmarket.service.MaterialScanService;
import com.univmarket.service.PurchaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MaterialController {

    private final MaterialRepository materialRepository;
    private final FileService fileService;
    private final PurchaseService purchaseService;
    private final MaterialService materialService;
    private final MaterialScanService materialScanService;

    /**
     * 자료 목록 (공개)
     */
    @GetMapping("/materials")
    public ResponseEntity<Page<Material>> listMaterials(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageRequest = PageRequest.of(page, Math.min(size, 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(materialRepository.findByHiddenFalseAndCopyrightDeletedFalse(pageRequest));
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
     */
    @PostMapping("/materials/{id}/download-url")
    public ResponseEntity<Map<String, String>> getDownloadUrl(
            @AuthenticationPrincipal FirebaseUserPrincipal principal,
            @PathVariable Long id) {
        Material material = materialRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("자료를 찾을 수 없습니다."));

        String downloadUrl = fileService.generateDownloadUrl(material.getFileKey(), material.getFileName());
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
