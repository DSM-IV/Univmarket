package com.univmarket.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.univmarket.entity.User;
import com.univmarket.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Firebase ID Token을 검증하는 인증 필터.
 * Authorization: Bearer <firebase-id-token> 헤더에서 토큰을 추출하여 검증한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FirebaseAuthFilter extends OncePerRequestFilter {

    private final FirebaseAuth firebaseAuth;
    private final UserRoleService userRoleService;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String idToken = authHeader.substring(7);
            try {
                FirebaseToken decodedToken = firebaseAuth.verifyIdToken(idToken);
                String uid = decodedToken.getUid();
                String email = decodedToken.getEmail();
                String name = decodedToken.getName();

                // Firebase 인증된 사용자를 DB에 자동 생성 (첫 로그인 시)
                userRepository.findByFirebaseUid(uid).orElseGet(() -> {
                    User newUser = User.builder()
                            .firebaseUid(uid)
                            .email(email != null ? email : uid + "@firebase.local")
                            .displayName(name != null ? name : (email != null ? email : "사용자"))
                            .build();
                    return userRepository.save(newUser);
                });

                // DB에서 역할 조회
                List<SimpleGrantedAuthority> authorities = userRoleService.getAuthorities(uid);

                FirebaseUserPrincipal principal = new FirebaseUserPrincipal(uid, email, decodedToken);
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(principal, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);

            } catch (FirebaseAuthException e) {
                log.warn("Firebase token verification failed: {}", e.getMessage());
                // 인증 실패 시 SecurityContext를 설정하지 않음 → 403 처리
            }
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // 공개 엔드포인트는 필터 건너뛰기
        return path.startsWith("/api/public/")
                || path.startsWith("/api/auth/kakao-verify")
                || path.equals("/health");
    }
}
