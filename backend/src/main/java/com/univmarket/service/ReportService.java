package com.univmarket.service;

import com.univmarket.entity.Material;
import com.univmarket.entity.Report;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.MaterialRepository;
import com.univmarket.repository.ReportRepository;
import com.univmarket.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final UserRepository userRepository;
    private final MaterialRepository materialRepository;
    private final ReportRepository reportRepository;

    @Transactional
    public Report submitReport(String firebaseUid, Long materialId, String type, String reason,
                               String description, String originalSource, String contactEmail,
                               boolean isRightsHolder, Long purchaseId) {
        User reporter = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> ApiException.notFound("자료를 찾을 수 없습니다."));

        // 동일 사용자의 동일 자료 동일 타입 중복 신고 방지
        if (reportRepository.existsByReporterIdAndMaterialIdAndStatusAndType(
                reporter.getId(), materialId, "pending", type)) {
            throw ApiException.conflict("이미 동일한 신고가 접수되어 있습니다.");
        }

        // 하루 최대 신고 횟수 제한
        long dailyCount = reportRepository.countByReporterIdAndCreatedAtAfter(
                reporter.getId(), LocalDateTime.now().minusDays(1));
        if (dailyCount >= 10) {
            throw ApiException.tooManyRequests("하루 최대 10건까지 신고할 수 있습니다.");
        }

        return reportRepository.save(Report.builder()
                .material(material)
                .reporter(reporter)
                .type(type)
                .reason(reason)
                .description(description)
                .originalSource(originalSource)
                .contactEmail(contactEmail)
                .rightsHolder(isRightsHolder)
                .purchaseId(purchaseId)
                .build());
    }
}
