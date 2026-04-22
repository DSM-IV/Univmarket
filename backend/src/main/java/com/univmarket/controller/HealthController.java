package com.univmarket.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/health")
@RequiredArgsConstructor
public class HealthController {

    private final JdbcTemplate jdbcTemplate;

    @GetMapping
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/db")
    public ResponseEntity<Map<String, Object>> db() {
        try {
            Integer one = jdbcTemplate.queryForObject("SELECT 1 FROM DUAL", Integer.class);
            return ResponseEntity.ok(Map.of(
                "status", "ok",
                "probe", one == null ? 0 : one
            ));
        } catch (Exception e) {
            return ResponseEntity.status(503).body(Map.of(
                "status", "down",
                "error", e.getClass().getSimpleName(),
                "message", e.getMessage() == null ? "" : e.getMessage()
            ));
        }
    }
}
