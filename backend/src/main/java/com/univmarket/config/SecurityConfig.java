package com.univmarket.config;

import com.univmarket.security.FirebaseAuthFilter;
import com.univmarket.security.RateLimitFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // @PreAuthorize 활성화
@RequiredArgsConstructor
public class SecurityConfig {

    private final FirebaseAuthFilter firebaseAuthFilter;
    private final RateLimitFilter rateLimitFilter;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${app.allow-localhost-cors:false}")
    private boolean allowLocalhostCors;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // CSRF 비활성화 (JWT 사용, 세션 없음)
            .csrf(csrf -> csrf.disable())

            // CORS 설정
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // 세션 미사용 (Stateless)
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // 보안 헤더
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .contentTypeOptions(content -> {})
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(63072000))
            )

            // URL별 접근 권한 설정
            .authorizeHttpRequests(auth -> auth
                // 공개 엔드포인트
                .requestMatchers("/health", "/health/**").permitAll()
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/api/auth/kakao-verify/**").permitAll()
                .requestMatchers("/api/payments/kakaopay/approve").permitAll() // 카카오 콜백
                .requestMatchers(HttpMethod.GET, "/api/materials", "/api/materials/{id}").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/materials/{id}/reviews").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/material-requests", "/api/material-requests/{id}").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/reviews/stats").permitAll()

                // 관리자 전용 엔드포인트
                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                // 나머지는 인증 필요
                .anyRequest().authenticated()
            )

            // 필터 체인: RateLimit → Firebase Auth → Spring Security
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(firebaseAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        List<String> origins = new ArrayList<>(List.of(
                frontendUrl,
                "https://unifile.store",
                "https://www.unifile.store"
        ));
        // localhost는 ALLOW_LOCALHOST_CORS=true 일 때만 허용 (로컬 개발 전용).
        // 운영 .env 에는 절대 설정 X — 켜면 공격자가 로컬에서 띄운 서비스가 사용자 브라우저 통해 API 호출 가능.
        if (allowLocalhostCors) {
            origins.add("http://localhost:5173");
            origins.add("http://localhost:5174");
            origins.add("http://localhost:3000");
        }
        config.setAllowedOrigins(origins);

        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
