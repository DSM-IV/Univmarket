package com.univmarket.config;

import com.fasterxml.jackson.datatype.hibernate6.Hibernate6Module;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Jackson + Hibernate 6 설정.
 * 초기화되지 않은 Lazy 프록시를 직렬화하려 들면 폭발하는 문제를
 * 전역으로 방지: 미초기화 프록시는 null로 출력 (FORCE_LAZY_LOADING off).
 */
@Configuration
public class JacksonConfig {

    @Bean
    public Hibernate6Module hibernate6Module() {
        Hibernate6Module module = new Hibernate6Module();
        // FORCE_LAZY_LOADING=true 면 직렬화 시점에 강제로 lazy 로드 → N+1 위험.
        // 기본 false 유지: 미초기화 프록시는 그냥 null로 직렬화.
        module.disable(Hibernate6Module.Feature.FORCE_LAZY_LOADING);
        return module;
    }
}
