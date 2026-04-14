package com.univmarket.service;

import com.univmarket.entity.Material;
import com.univmarket.entity.MaterialFile;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.MaterialRepository;
import com.univmarket.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MaterialService {

    private final UserRepository userRepository;
    private final MaterialRepository materialRepository;

    private static final Duration UPLOAD_COOLDOWN = Duration.ofMinutes(5);
    private static final int MAX_FILES = 10;
    private static final int MAX_PREVIEW_IMAGES = 10;

    /**
     * 자료 등록 (5분 쿨다운 검증)
     */
    @Transactional
    public Material createMaterial(String firebaseUid, Map<String, Object> payload) {
        User author = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자 정보를 찾을 수 없습니다."));

        if (author.isBanned()) {
            throw ApiException.forbidden("정지된 계정은 자료를 등록할 수 없습니다.");
        }

        // 쿨다운 검증
        Page<Material> recent = materialRepository.findByAuthorId(
                author.getId(),
                PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "createdAt")));
        if (!recent.isEmpty()) {
            LocalDateTime lastCreated = recent.getContent().get(0).getCreatedAt();
            if (lastCreated != null &&
                    Duration.between(lastCreated, LocalDateTime.now()).compareTo(UPLOAD_COOLDOWN) < 0) {
                long remaining = UPLOAD_COOLDOWN.minus(Duration.between(lastCreated, LocalDateTime.now())).toSeconds();
                throw ApiException.tooManyRequests(
                        "자료 등록 후 5분간 재등록할 수 없습니다. (" + remaining + "초 남음)");
            }
        }

        String title = asString(payload.get("title"));
        String description = asString(payload.get("description"));
        Integer price = asInt(payload.get("price"));

        if (title == null || title.isBlank()) {
            throw ApiException.badRequest("제목은 필수입니다.");
        }
        if (title.length() > 200) {
            throw ApiException.badRequest("제목이 너무 깁니다. (최대 200자)");
        }
        if (price == null || price < 0 || price > 500_000) {
            throw ApiException.badRequest("판매 가격은 0원 이상 500,000원 이하의 정수여야 합니다.");
        }

        String fileUrl = asString(payload.get("fileUrl"));
        String fileKey = asString(payload.get("fileKey"));
        String fileName = asString(payload.get("fileName"));
        if (fileUrl == null || fileKey == null) {
            throw ApiException.badRequest("자료 파일이 필요합니다.");
        }

        List<String> fileUrls = asStringList(payload.get("fileUrls"));
        List<String> fileKeys = asStringList(payload.get("fileKeys"));
        List<String> fileNames = asStringList(payload.get("fileNames"));
        List<Long> fileSizes = asLongList(payload.get("fileSizes"));
        List<String> fileTypes = asStringList(payload.get("fileTypes"));

        if (fileUrls.size() > MAX_FILES) {
            throw ApiException.badRequest("파일은 최대 " + MAX_FILES + "개까지 첨부할 수 있습니다.");
        }

        List<MaterialFile> files = new ArrayList<>();
        int n = fileUrls.size();
        for (int i = 0; i < n; i++) {
            files.add(MaterialFile.builder()
                    .fileUrl(fileUrls.get(i))
                    .fileKey(i < fileKeys.size() ? fileKeys.get(i) : null)
                    .fileName(i < fileNames.size() ? fileNames.get(i) : null)
                    .fileSize(i < fileSizes.size() ? fileSizes.get(i) : null)
                    .fileType(i < fileTypes.size() ? fileTypes.get(i) : null)
                    .build());
        }

        List<String> previewImages = asStringList(payload.get("previewImages"));
        if (previewImages.size() > MAX_PREVIEW_IMAGES) {
            previewImages = previewImages.subList(0, MAX_PREVIEW_IMAGES);
        }

        Material material = Material.builder()
                .author(author)
                .title(title.trim())
                .description(description != null ? description : "")
                .price(price)
                .subject(trimOrNull(asString(payload.get("subject")), 50))
                .professor(trimOrNull(asString(payload.get("professor")), 50))
                .category(trimOrNull(asString(payload.get("category")), 20))
                .department(trimOrNull(asString(payload.get("department")), 50))
                .semester(trimOrNull(asString(payload.get("semester")), 20))
                .fileType(trimOrNull(asString(payload.get("fileType")), 50))
                .pages(defaultInt(asInt(payload.get("pages")), 0))
                .fileCount(defaultInt(asInt(payload.get("fileCount")), files.size()))
                .fileKey(fileKey)
                .fileUrl(fileUrl)
                .fileName(fileName)
                .fileSize(asLong(payload.get("fileSize")))
                .contentType(asString(payload.get("contentType")))
                .thumbnail(asString(payload.get("thumbnail")))
                .files(files)
                .previewImages(new ArrayList<>(previewImages))
                .gradeImage(asString(payload.get("gradeImage")))
                .gradeClaim(trimOrNull(asString(payload.get("gradeClaim")), 10))
                .gradeStatus(trimOrNull(asString(payload.get("gradeStatus")), 20))
                .scanStatus("pending")
                .hidden(false)
                .copyrightDeleted(false)
                .build();

        return materialRepository.save(material);
    }

    /**
     * 내 자료 목록 — 최신순 (쿨다운 체크용)
     */
    @Transactional(readOnly = true)
    public List<Material> listMyMaterials(String firebaseUid, int limit) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자 정보를 찾을 수 없습니다."));

        int safeLimit = Math.max(1, Math.min(limit, 50));
        Page<Material> page = materialRepository.findByAuthorId(
                user.getId(),
                PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "createdAt")));
        return page.getContent();
    }

    // --- payload 파서 ---

    private static String asString(Object v) {
        if (v == null) return null;
        String s = v.toString();
        return s.isEmpty() ? null : s;
    }

    private static Integer asInt(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.intValue();
        try { return Integer.parseInt(v.toString()); } catch (Exception e) { return null; }
    }

    private static Long asLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return null; }
    }

    private static List<String> asStringList(Object v) {
        if (!(v instanceof List<?> list)) return List.of();
        List<String> out = new ArrayList<>(list.size());
        for (Object o : list) if (o != null) out.add(o.toString());
        return out;
    }

    private static List<Long> asLongList(Object v) {
        if (!(v instanceof List<?> list)) return List.of();
        List<Long> out = new ArrayList<>(list.size());
        for (Object o : list) {
            Long l = asLong(o);
            if (l != null) out.add(l);
        }
        return out;
    }

    private static int defaultInt(Integer v, int fallback) {
        return v == null ? fallback : v;
    }

    private static String trimOrNull(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
