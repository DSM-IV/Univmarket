package com.univmarket.service;

import com.univmarket.entity.MaterialRequest;
import com.univmarket.entity.MaterialRequestComment;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.MaterialRequestCommentRepository;
import com.univmarket.repository.MaterialRequestRepository;
import com.univmarket.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MaterialRequestService {

    private final UserRepository userRepository;
    private final MaterialRequestRepository materialRequestRepository;
    private final MaterialRequestCommentRepository materialRequestCommentRepository;

    @Transactional(readOnly = true)
    public Page<MaterialRequest> listRequests(int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, Math.min(size, 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return materialRequestRepository.findAllByOrderByCreatedAtDesc(pageRequest);
    }

    @Transactional
    public MaterialRequest submitRequest(String firebaseUid, String subject, String professor,
                                          String description, String category) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        if (subject == null || subject.isBlank()) {
            throw ApiException.badRequest("과목명을 입력해주세요.");
        }

        return materialRequestRepository.save(MaterialRequest.builder()
                .user(user)
                .nickname(user.getNickname() != null ? user.getNickname() : "익명")
                .subject(subject)
                .professor(professor)
                .description(description)
                .category(category)
                .build());
    }

    @Transactional
    public Map<String, Object> toggleNeed(String firebaseUid, Long requestId) {
        // 간단하게 needCount를 +1 처리 (실제로는 유저별 토글 상태 관리 필요)
        MaterialRequest request = materialRequestRepository.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("요청을 찾을 수 없습니다."));

        materialRequestRepository.updateNeedCount(requestId, 1);

        return Map.of("success", true, "needCount", request.getNeedCount() + 1);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRequestWithComments(Long requestId) {
        MaterialRequest request = materialRequestRepository.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("요청을 찾을 수 없습니다."));

        List<MaterialRequestComment> comments =
                materialRequestCommentRepository.findByRequestIdOrderByCreatedAtAsc(requestId);

        return Map.of("request", request, "comments", comments);
    }

    @Transactional
    public MaterialRequestComment addComment(String firebaseUid, Long requestId, String content) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));
        MaterialRequest request = materialRequestRepository.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("요청을 찾을 수 없습니다."));

        if (content == null || content.isBlank() || content.length() > 1000) {
            throw ApiException.badRequest("댓글 내용은 1~1000자여야 합니다.");
        }

        return materialRequestCommentRepository.save(MaterialRequestComment.builder()
                .request(request)
                .user(user)
                .nickname(user.getNickname() != null ? user.getNickname() : "익명")
                .content(content.trim())
                .build());
    }

    @Transactional
    public void deleteComment(String firebaseUid, Long requestId, Long commentId) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        MaterialRequestComment comment = materialRequestCommentRepository.findById(commentId)
                .orElseThrow(() -> ApiException.notFound("댓글을 찾을 수 없습니다."));

        if (!comment.getRequest().getId().equals(requestId)) {
            throw ApiException.badRequest("잘못된 요청입니다.");
        }

        if (!comment.getUser().getId().equals(user.getId())) {
            throw ApiException.forbidden("본인의 댓글만 삭제할 수 있습니다.");
        }

        materialRequestCommentRepository.delete(comment);
    }
}
