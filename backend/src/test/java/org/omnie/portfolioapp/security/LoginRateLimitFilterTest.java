package org.omnie.portfolioapp.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.omnie.portfolioapp.common.ratelimit.FixedWindowRateLimiter;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LoginRateLimitFilterTest {

    private final LoginRateLimitFilter filter = new LoginRateLimitFilter(
            request -> true,
            new FixedWindowRateLimiter(2, Duration.ofMinutes(15), Clock.systemUTC()),
            1);

    private static MockHttpServletRequest requestFrom(String address) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr(address);
        return request;
    }

    @Test
    void manyAddressesFailingCannotLockOutAnotherClient() throws Exception {
        FilterChain fails = (request, response) -> ((MockHttpServletResponse) response).setStatus(401);
        for (int i = 1; i <= 100; i++) {
            String address = "203.0.113." + i;
            filter.doFilter(requestFrom(address), new MockHttpServletResponse(), fails);
            filter.doFilter(requestFrom(address), new MockHttpServletResponse(), fails);
        }

        MockHttpServletResponse owner = new MockHttpServletResponse();
        filter.doFilter(requestFrom("198.51.100.1"), owner,
                (request, response) -> ((MockHttpServletResponse) response).setStatus(204));

        assertEquals(204, owner.getStatus());
    }

    @Test
    void busyLoginIsRefusedWithoutUsingUpTheClientsAttempts() throws Exception {
        CountDownLatch inside = new CountDownLatch(1);
        CountDownLatch finish = new CountDownLatch(1);
        Thread running = new Thread(() -> {
            try {
                filter.doFilter(requestFrom("203.0.113.1"), new MockHttpServletResponse(), (request, response) -> {
                    inside.countDown();
                    try {
                        finish.await(5, TimeUnit.SECONDS);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                });
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        });
        running.start();
        assertTrue(inside.await(5, TimeUnit.SECONDS));

        for (int i = 0; i < 3; i++) {
            MockHttpServletResponse busy = new MockHttpServletResponse();
            filter.doFilter(requestFrom("198.51.100.1"), busy, (request, response) -> {
                throw new AssertionError("Must not reach bcrypt");
            });
            assertEquals(429, busy.getStatus());
            assertEquals("1", busy.getHeader(HttpHeaders.RETRY_AFTER));
        }
        finish.countDown();
        running.join(5_000);

        MockHttpServletResponse next = new MockHttpServletResponse();
        filter.doFilter(requestFrom("198.51.100.1"), next,
                (request, response) -> ((MockHttpServletResponse) response).setStatus(204));
        assertEquals(204, next.getStatus());
    }

    @Test
    void slotIsReturnedWhenLoginThrows() throws Exception {
        try {
            filter.doFilter(requestFrom("203.0.113.1"), new MockHttpServletResponse(), (request, response) -> {
                throw new IllegalStateException("boom");
            });
        } catch (IllegalStateException expected) {
            // The exception is not what this test checks.
        }

        MockHttpServletResponse next = new MockHttpServletResponse();
        filter.doFilter(requestFrom("198.51.100.1"), next,
                (request, response) -> ((MockHttpServletResponse) response).setStatus(204));
        assertEquals(204, next.getStatus());
    }
}
