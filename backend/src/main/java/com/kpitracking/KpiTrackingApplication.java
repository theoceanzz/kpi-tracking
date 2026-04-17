package com.kpitracking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class KpiTrackingApplication {

    public static void main(String[] args) {
        SpringApplication.run(KpiTrackingApplication.class, args);
    }

}
