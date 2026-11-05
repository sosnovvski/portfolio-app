package org.omnie.portfolioapp.common.error;

import java.time.Duration;

public class RateLimitedException extends RuntimeException {

    private final transient Duration retryAfter;

    public RateLimitedException(Duration retryAfter, String message) {
        super(message);
        this.retryAfter = retryAfter;
    }

    public Duration getRetryAfter() {
        return retryAfter;
    }
}
