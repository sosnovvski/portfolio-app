package org.omnie.portfolioapp.common.ratelimit;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FixedWindowRateLimiterTest {

    private static final Duration WINDOW = Duration.ofMinutes(15);

    private static final class FakeClock extends Clock {
        private Instant now = Instant.parse("2026-01-01T00:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }

    private final FakeClock clock = new FakeClock();
    private final FixedWindowRateLimiter limiter = new FixedWindowRateLimiter(2, WINDOW, clock);

    @Test
    void allowsUpToTheLimitThenReportsRemainingWait() {
        assertTrue(limiter.tryAcquire("a").allowed());
        clock.advance(Duration.ofMinutes(5));
        assertTrue(limiter.tryAcquire("a").allowed());

        FixedWindowRateLimiter.Decision denied = limiter.tryAcquire("a");

        assertFalse(denied.allowed());
        assertEquals(Duration.ofMinutes(10), denied.retryAfter());
    }

    @Test
    void keysAreIndependent() {
        limiter.tryAcquire("a");
        limiter.tryAcquire("a");

        assertFalse(limiter.tryAcquire("a").allowed());
        assertTrue(limiter.tryAcquire("b").allowed());
    }

    @Test
    void newWindowResetsTheCount() {
        limiter.tryAcquire("a");
        limiter.tryAcquire("a");
        assertFalse(limiter.tryAcquire("a").allowed());

        clock.advance(WINDOW.plusSeconds(1));

        assertTrue(limiter.tryAcquire("a").allowed());
    }

    @Test
    void deniedAttemptsDoNotExtendTheWindow() {
        limiter.tryAcquire("a");
        limiter.tryAcquire("a");
        clock.advance(Duration.ofMinutes(14));
        assertFalse(limiter.tryAcquire("a").allowed());

        clock.advance(Duration.ofMinutes(1).plusSeconds(1));

        assertTrue(limiter.tryAcquire("a").allowed());
    }

    @Test
    void releaseReturnsAnAttempt() {
        limiter.tryAcquire("a");
        limiter.tryAcquire("a");

        limiter.release("a");

        assertTrue(limiter.tryAcquire("a").allowed());
        assertFalse(limiter.tryAcquire("a").allowed());
    }

    @Test
    void releaseOfUnknownKeyIsIgnored() {
        limiter.release("unknown");

        assertTrue(limiter.tryAcquire("unknown").allowed());
    }
}
