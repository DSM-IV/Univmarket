package com.univmarket.security;

import com.google.firebase.auth.FirebaseToken;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * SecurityContext에 저장되는 인증된 사용자 정보.
 * Firebase UID를 기본 식별자로 사용한다.
 */
@Getter
@RequiredArgsConstructor
public class FirebaseUserPrincipal {
    private final String uid;
    private final String email;
    private final FirebaseToken firebaseToken;
}
