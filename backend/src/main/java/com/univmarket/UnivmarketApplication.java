package com.univmarket;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class UnivmarketApplication {
    public static void main(String[] args) {
        SpringApplication.run(UnivmarketApplication.class, args);
    }
}
