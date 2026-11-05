package org.omnie.portfolioapp.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.time.Clock;

@Configuration
@EnableScheduling
class TimeConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
