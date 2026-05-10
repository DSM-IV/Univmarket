package com.univmarket.service;

import com.univmarket.entity.MaterialRequest;
import com.univmarket.entity.MaterialRequestComment;
import com.univmarket.entity.MaterialRequestNeed;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.MaterialRequestCommentRepository;
import com.univmarket.repository.MaterialRequestNeedRepository;
import com.univmarket.repository.MaterialRequestRepository;
import com.univmarket.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class MaterialRequestService {

    private final UserRepository userRepository;
    private final MaterialRequestRepository materialRequestRepository;
    private final MaterialRequestCommentRepository materialRequestCommentRepository;
    private final MaterialRequestNeedRepository materialRequestNeedRepository;

    /**
     * 자료 요청 목록.
     * firebaseUid가 주어지면 각 요청에 대해 본인이 공감했는지(alreadyNeed)를 채워서 반환.
     */
    @Transactional(readOnly = true)
    public Page<MaterialRequest> listRequests(int page, int size, String firebaseUid) {
        PageRequest pageRequest = PageRequest.of(page, Math.min(size, 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<MaterialRequest> requests = materialRequestRepository.findAllByOrderByCreatedAtDesc(pageRequest);

        Set<Long> userNeedRequestIds = needRequestIdsForUser(firebaseUid,
                requests.getContent().stream().map(MaterialRequest::getId).toList());
        requests.forEach(req -> req.setAlreadyNeed(userNeedRequestIds.contains(req.getId())));
        return requests;
    }

    @Transactional
    public MaterialRequest submitRequest(String firebaseUid, String subject, String professor,
                                          String description, String category) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        if (subject == null || subject.isBlank()) {
            throw ApiException.badRequest("과목명을 입력해주세요.");
        }

        MaterialRequest saved = materialRequestRepository.save(MaterialRequest.builder()
                .user(user)
                .nickname(user.getNickname() != null ? user.getNickname() : "익명")
                .subject(subject)
                .professor(professor)
                .description(description)
                .category(category)
                .needCount(1)
                .build());

        // 등록자를 첫 공감자로 자동 등록
        materialRequestNeedRepository.save(MaterialRequestNeed.builder()
                .requestId(saved.getId())
                .userId(user.getId())
                .build());

        saved.setAlreadyNeed(true);
        return saved;
    }

    /**
     * "저도 필요해요" 진짜 토글:
     *  - 이미 눌렀으면 취소 (needCount -1). 0이 되면 요청 자체 삭제.
     *  - 안 눌렀으면 추가 (needCount +1).
     */
    @Transactional
    public Map<String, Object> toggleNeed(String firebaseUid, Long requestId) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        MaterialRequest request = materialRequestRepository.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("요청을 찾을 수 없습니다."));

        boolean currentlyNeeds = materialRequestNeedRepository
                .existsByRequestIdAndUserId(requestId, user.getId());

        if (currentlyNeeds) {
            materialRequestNeedRepository.deleteByRequestIdAndUserId(requestId, user.getId());
            int newCount = Math.max(0, request.getNeedCount() - 1);
            if (newCount == 0) {
                materialRequestRepository.delete(request);
                return Map.of("deleted", true);
            }
            request.setNeedCount(newCount);
            materialRequestRepository.save(request);
            return Map.of("added", false, "alreadyNeed", false, "needCount", newCount);
        } else {
            materialRequestNeedRepository.save(MaterialRequestNeed.builder()
                    .requestId(requestId)
                    .userId(user.getId())
                    .build());
            int newCount = request.getNeedCount() + 1;
            request.setNeedCount(newCount);
            materialRequestRepository.save(request);
            return Map.of("added", true, "alreadyNeed", true, "needCount", newCount);
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRequestWithComments(Long requestId, String firebaseUid) {
        MaterialRequest request = materialRequestRepository.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("요청을 찾을 수 없습니다."));

        Set<Long> userNeedRequestIds = needRequestIdsForUser(firebaseUid, List.of(requestId));
        request.setAlreadyNeed(userNeedRequestIds.contains(requestId));

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

    private Set<Long> needRequestIdsForUser(String firebaseUid, List<Long> requestIds) {
        if (firebaseUid == null || requestIds.isEmpty()) return Collections.emptySet();
        User user = userRepository.findByFirebaseUid(firebaseUid).orElse(null);
        if (user == null) return Collections.emptySet();
        return new HashSet<>(materialRequestNeedRepository
                .findRequestIdsByUserIdAndRequestIdIn(user.getId(), requestIds));
    }
}
