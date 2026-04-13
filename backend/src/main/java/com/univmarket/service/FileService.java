package com.univmarket.service;

import com.univmarket.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import org.springframework.beans.factory.annotation.Autowired;

import java.time.Duration;
import java.util.Map;

@Slf4j
@Service
public class FileService {

    private final S3Client r2Client;
    private final S3Presigner r2Presigner;

    @Autowired
    public FileService(@Autowired(required = false) S3Client r2Client,
                       @Autowired(required = false) S3Presigner r2Presigner) {
        this.r2Client = r2Client;
        this.r2Presigner = r2Presigner;
    }

    @Value("${r2.bucket-name}")
    private String bucketName;

    @Value("${r2.public-url}")
    private String publicUrl;

    private static final long MAX_UPLOAD_BYTES = 60 * 1024 * 1024; // 60MB

    /**
     * 업로드용 Presigned URL 생성
     */
    public Map<String, String> generateUploadUrl(String uid, String fileName, String contentType, long fileSize) {
        if (r2Presigner == null) {
            throw ApiException.badRequest("파일 스토리지가 설정되지 않았습니다.");
        }
        if (fileSize <= 0 || fileSize > MAX_UPLOAD_BYTES) {
            throw ApiException.badRequest("파일 크기가 유효하지 않습니다. (최대 60MB)");
        }

        String safeName = sanitizeFileName(fileName);
        String key = "materials/" + uid + "/" + System.currentTimeMillis() + "_" + safeName;

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(10))
                .putObjectRequest(PutObjectRequest.builder()
                        .bucket(bucketName)
                        .key(key)
                        .contentType(contentType)
                        .build())
                .build();

        String uploadUrl = r2Presigner.presignPutObject(presignRequest).url().toString();
        String fileUrl = publicUrl + "/" + key;

        return Map.of("uploadUrl", uploadUrl, "fileUrl", fileUrl, "key", key);
    }

    /**
     * 다운로드용 Presigned URL 생성
     */
    public String generateDownloadUrl(String fileKey, String fileName) {
        if (r2Presigner == null) {
            throw ApiException.badRequest("파일 스토리지가 설정되지 않았습니다.");
        }
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(5))
                .getObjectRequest(GetObjectRequest.builder()
                        .bucket(bucketName)
                        .key(fileKey)
                        .responseContentDisposition("attachment; filename=\"" + fileName + "\"")
                        .build())
                .build();

        return r2Presigner.presignGetObject(presignRequest).url().toString();
    }

    /**
     * R2에서 파일 삭제 (최대 3회 재시도)
     */
    public boolean deleteFile(String fileKey) {
        if (r2Client == null) {
            log.warn("R2 클라이언트가 설정되지 않아 파일 삭제를 건너뜁니다.");
            return false;
        }
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                r2Client.deleteObject(DeleteObjectRequest.builder()
                        .bucket(bucketName)
                        .key(fileKey)
                        .build());
                return true;
            } catch (Exception e) {
                log.warn("R2 파일 삭제 실패 (시도 {}/3): {}", attempt + 1, e.getMessage());
            }
        }
        return false;
    }

    private String sanitizeFileName(String fileName) {
        int lastDot = fileName.lastIndexOf('.');
        String ext = lastDot >= 0 ? fileName.substring(lastDot + 1).toLowerCase().replaceAll("[^a-z0-9]", "") : "";
        String base = (lastDot >= 0 ? fileName.substring(0, lastDot) : fileName)
                .replaceAll("[^a-zA-Z0-9\\-_]", "_")
                .replaceAll("_{2,}", "_")
                .replaceAll("^_+|_+$", "");
        if (base.length() > 80) base = base.substring(0, 80);
        if (base.isEmpty()) base = "file";
        return ext.isEmpty() ? base : base + "." + ext;
    }
}
