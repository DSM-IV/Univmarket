package com.univmarket.service;

import com.univmarket.entity.Material;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.MaterialRepository;
import com.univmarket.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import java.time.Duration;
import java.util.Map;

@Slf4j
@Service
public class MaterialScanService {

    private final MaterialRepository materialRepository;
    private final UserRepository userRepository;
    private final S3Client r2Client;

    private final String virustotalApiKey;
    private final String r2BucketName;

    private final WebClient vtClient;

    public MaterialScanService(MaterialRepository materialRepository,
                               UserRepository userRepository,
                               @Autowired(required = false) S3Client r2Client,
                               @Value("${virustotal.api-key:}") String virustotalApiKey,
                               @Value("${r2.bucket-name}") String r2BucketName) {
        this.materialRepository = materialRepository;
        this.userRepository = userRepository;
        this.r2Client = r2Client;
        this.virustotalApiKey = virustotalApiKey;
        this.r2BucketName = r2BucketName;
        this.vtClient = WebClient.builder()
                .baseUrl("https://www.virustotal.com/api/v3")
                .codecs(c -> c.defaultCodecs().maxInMemorySize(80 * 1024 * 1024))
                .build();
    }

    /**
     * 비동기 스캔 시작 — 본인 자료만 허용
     */
    public void startScan(String firebaseUid, Long materialId) {
        var author = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자 정보를 찾을 수 없습니다."));
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> ApiException.notFound("자료를 찾을 수 없습니다."));
        if (!material.getAuthor().getId().equals(author.getId())) {
            throw ApiException.forbidden("본인의 자료만 검사할 수 있습니다.");
        }

        if (virustotalApiKey == null || virustotalApiKey.isBlank()) {
            // SECURITY: API 키 미설정 시 검사 불가 → 업로드 차단 (fail-secure)
            log.error("[SECURITY] VIRUSTOTAL_API_KEY 미설정 — 파일 검사 불가, 업로드 차단 (materialId={})", materialId);
            markScanUnavailable(materialId);
            throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "바이러스 검사 서비스가 설정되지 않았습니다. 관리자에게 문의해주세요.");
        }

        runScanAsync(materialId);
    }

    @Async
    public void runScanAsync(Long materialId) {
        try {
            scanAndUpdate(materialId);
        } catch (Exception e) {
            log.error("바이러스 검사 실패 (materialId={}): {}", materialId, e.getMessage(), e);
            markScanError(materialId);
        }
    }

    private void scanAndUpdate(Long materialId) {
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new IllegalStateException("자료 없음: " + materialId));

        String fileKey = material.getFileKey();
        if (fileKey == null || r2Client == null) {
            markScanError(materialId);
            return;
        }

        // R2에서 파일 바이트 로드
        byte[] bytes;
        try {
            ResponseBytes<GetObjectResponse> obj = r2Client.getObjectAsBytes(
                    GetObjectRequest.builder().bucket(r2BucketName).key(fileKey).build());
            bytes = obj.asByteArray();
        } catch (Exception e) {
            log.error("R2 파일 로드 실패: {}", e.getMessage());
            markScanError(materialId);
            return;
        }

        // VirusTotal 업로드
        MultipartBodyBuilder mb = new MultipartBodyBuilder();
        String displayName = material.getFileName() != null ? material.getFileName() : "file";
        mb.part("file", new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return displayName;
            }
        }).contentType(MediaType.APPLICATION_OCTET_STREAM);

        Map<String, Object> uploadResponse;
        try {
            uploadResponse = vtClient.post()
                    .uri("/files")
                    .header("x-apikey", virustotalApiKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(mb.build()))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofSeconds(60));
        } catch (Exception e) {
            log.error("VirusTotal 업로드 실패: {}", e.getMessage());
            markScanError(materialId);
            return;
        }

        String analysisId = extractAnalysisId(uploadResponse);
        if (analysisId == null) {
            markScanError(materialId);
            return;
        }

        // 결과 폴링 (최대 60초)
        String result = "scanning";
        for (int i = 0; i < 12; i++) {
            try {
                Thread.sleep(5000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }

            Map<String, Object> analysisResponse;
            try {
                analysisResponse = vtClient.get()
                        .uri("/analyses/{id}", analysisId)
                        .header("x-apikey", virustotalApiKey)
                        .retrieve()
                        .bodyToMono(Map.class)
                        .block(Duration.ofSeconds(15));
            } catch (Exception e) {
                log.warn("VirusTotal 분석 조회 실패 (재시도): {}", e.getMessage());
                continue;
            }

            String status = extractAnalysisStatus(analysisResponse);
            if ("completed".equals(status)) {
                result = extractVerdict(analysisResponse);
                break;
            }
        }

        updateScanStatus(materialId, result);

        if ("infected".equals(result)) {
            // 감염 파일 → R2 삭제 + 비공개
            try {
                r2Client.deleteObject(DeleteObjectRequest.builder()
                        .bucket(r2BucketName)
                        .key(fileKey)
                        .build());
            } catch (Exception e) {
                log.warn("감염 파일 삭제 실패: {}", e.getMessage());
            }
            markHidden(materialId);
        }
    }

    @Transactional
    protected void updateScanStatus(Long materialId, String status) {
        materialRepository.findById(materialId).ifPresent(m -> {
            m.setScanStatus(status);
            materialRepository.save(m);
        });
    }

    /**
     * 스캔 중 복구 불가능한 오류 발생 → 안전하게 숨김 처리.
     */
    @Transactional
    protected void markScanError(Long materialId) {
        materialRepository.findById(materialId).ifPresent(m -> {
            m.setScanStatus("error");
            m.setHidden(true);
            materialRepository.save(m);
        });
    }

    @Transactional
    protected void markScanUnavailable(Long materialId) {
        materialRepository.findById(materialId).ifPresent(m -> {
            m.setScanStatus("unavailable");
            m.setHidden(true);
            materialRepository.save(m);
        });
    }

    @Transactional
    protected void markHidden(Long materialId) {
        materialRepository.findById(materialId).ifPresent(m -> {
            m.setHidden(true);
            materialRepository.save(m);
        });
    }

    @SuppressWarnings("unchecked")
    private String extractAnalysisId(Map<String, Object> response) {
        if (response == null) return null;
        Object data = response.get("data");
        if (data instanceof Map<?, ?> m) {
            Object id = m.get("id");
            return id != null ? id.toString() : null;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private String extractAnalysisStatus(Map<String, Object> response) {
        if (response == null) return null;
        Object data = response.get("data");
        if (data instanceof Map<?, ?> m) {
            Object attrs = m.get("attributes");
            if (attrs instanceof Map<?, ?> a) {
                Object status = a.get("status");
                return status != null ? status.toString() : null;
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private String extractVerdict(Map<String, Object> response) {
        if (response == null) return "error";
        Object data = response.get("data");
        if (data instanceof Map<?, ?> m) {
            Object attrs = m.get("attributes");
            if (attrs instanceof Map<?, ?> a) {
                Object stats = a.get("stats");
                if (stats instanceof Map<?, ?> s) {
                    int malicious = asInt(s.get("malicious"));
                    int suspicious = asInt(s.get("suspicious"));
                    return (malicious + suspicious) > 0 ? "infected" : "clean";
                }
            }
        }
        return "error";
    }

    private int asInt(Object v) {
        if (v instanceof Number n) return n.intValue();
        if (v == null) return 0;
        try { return Integer.parseInt(v.toString()); } catch (Exception e) { return 0; }
    }
}
