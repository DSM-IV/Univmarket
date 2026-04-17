package com.univmarket.service;

import com.univmarket.entity.Notification;
import com.univmarket.entity.Purchase;
import com.univmarket.entity.Transaction;
import com.univmarket.entity.User;
import com.univmarket.exception.ApiException;
import com.univmarket.repository.NotificationRepository;
import com.univmarket.repository.PurchaseRepository;
import com.univmarket.repository.TransactionRepository;
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
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final PurchaseRepository purchaseRepository;
    private final NotificationRepository notificationRepository;

    private static final Pattern NICKNAME_PATTERN = Pattern.compile("^[가-힣a-zA-Z0-9_]{2,16}$");

    /**
     * 사용자 프로필 생성
     */
    @Transactional
    public User createProfile(String firebaseUid, String email, String displayName, String nickname) {
        if (userRepository.findByFirebaseUid(firebaseUid).isPresent()) {
            throw ApiException.conflict("이미 프로필이 존재합니다.");
        }

        validateNickname(nickname);

        User user = User.builder()
                .firebaseUid(firebaseUid)
                .email(email)
                .displayName(displayName)
                .nickname(nickname)
                .build();

        return userRepository.save(user);
    }

    /**
     * 닉네임 변경
     */
    @Transactional
    public User updateNickname(String firebaseUid, String newNickname) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        validateNickname(newNickname);

        user.setNickname(newNickname);
        return userRepository.save(user);
    }

    /**
     * 내 프로필 조회
     */
    @Transactional(readOnly = true)
    public User getMyProfile(String firebaseUid) {
        return userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));
    }

    /**
     * 거래내역 조회
     */
    @Transactional(readOnly = true)
    public Page<Transaction> getTransactions(String firebaseUid, int page, int size) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        PageRequest pageRequest = PageRequest.of(page, Math.min(size, 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return transactionRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), pageRequest);
    }

    /**
     * 구매목록 조회
     */
    @Transactional(readOnly = true)
    public List<Purchase> getPurchases(String firebaseUid) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        return purchaseRepository.findByBuyerIdOrderByCreatedAtDesc(user.getId());
    }

    /**
     * 알림 목록 조회
     */
    @Transactional(readOnly = true)
    public List<Notification> getNotifications(String firebaseUid, int limit) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        PageRequest pageRequest = PageRequest.of(0, Math.min(Math.max(limit, 1), 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), pageRequest).getContent();
    }

    /**
     * 알림 읽음 처리
     */
    @Transactional
    public void markNotificationRead(String firebaseUid, Long notificationId) {
        User user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() -> ApiException.notFound("사용자를 찾을 수 없습니다."));

        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> ApiException.notFound("알림을 찾을 수 없습니다."));

        if (!notification.getUser().getId().equals(user.getId())) {
            throw ApiException.forbidden("본인의 알림만 읽음 처리할 수 있습니다.");
        }

        notification.setRead(true);
        notificationRepository.save(notification);
    }

    private void validateNickname(String nickname) {
        if (nickname == null || !NICKNAME_PATTERN.matcher(nickname).matches()) {
            throw ApiException.badRequest("닉네임은 2~16자의 한글, 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.");
        }
        if (userRepository.existsByNickname(nickname)) {
            throw ApiException.conflict("이미 사용 중인 닉네임입니다.");
        }
    }
}
