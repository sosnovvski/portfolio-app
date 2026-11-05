package org.omnie.portfolioapp.common.ratelimit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Counts attempts per key in fixed windows. State lives in memory, is bounded, and resets on restart.
 * Evicting a key under pressure resets its counter, so a global limiter should back per-client limits.
 */
public class FixedWindowRateLimiter {

    private static final int MAX_KEYS = 10_000;

    private record Window(Instant start, AtomicInteger used) {
    }

    /** {@code retryAfter} is meaningful only when the attempt is not allowed. */
    public record Decision(boolean allowed, Duration retryAfter) {
    }

    private final int limit;
    private final Duration window;
    private final Clock clock;
    private final Cache<String, Window> windows;

    public FixedWindowRateLimiter(int limit, Duration window, Clock clock) {
        this.limit = limit;
        this.window = window;
        this.clock = clock;
        this.windows = Caffeine.newBuilder()
                .expireAfterWrite(window)
                .maximumSize(MAX_KEYS)
                .executor(Runnable::run)
                .ticker(() -> {
                    Instant now = clock.instant();
                    return now.getEpochSecond() * 1_000_000_000L + now.getNano();
                })
                .build();
    }

    /** Atomically reserves one attempt, so parallel requests cannot pass the check together. */
    public Decision tryAcquire(String key) {
        Window current = windows.get(key, k -> new Window(clock.instant(), new AtomicInteger()));
        if (current.used().incrementAndGet() <= limit) {
            return new Decision(true, Duration.ZERO);
        }
        current.used().decrementAndGet();
        return new Decision(false, Duration.between(clock.instant(), current.start().plus(window)));
    }

    /** Returns an attempt reserved earlier, for example after a successful login. */
    public void release(String key) {
        Window current = windows.getIfPresent(key);
        if (current != null) {
            current.used().updateAndGet(used -> Math.max(0, used - 1));
        }
    }
}
