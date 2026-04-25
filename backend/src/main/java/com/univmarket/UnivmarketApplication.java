package com.univmarket;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

// Firebase Auth Filter로 직접 인증 처리하므로 Spring 기본 in-memory user 비활성.
// 기본 user가 살아있으면 "Using generated security password" 로그 경고 + 향후 httpBasic 켤 때 백도어 위험.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableScheduling
public class UnivmarketApplication {
    public static void main(String[] args) {
        SpringApplication.run(UnivmarketApplication.class, args);
    }
}
