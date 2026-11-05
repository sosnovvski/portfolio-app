package org.omnie.portfolioapp.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.omnie.portfolioapp.common.error.ProblemWriter;
import org.omnie.portfolioapp.common.ratelimit.ClientKey;
import org.omnie.portfolioapp.common.ratelimit.FixedWindowRateLimiter;
import org.omnie.portfolioapp.common.ratelimit.FixedWindowRateLimiter.Decision;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.Semaphore;

/**
 * Limits failed logins per client, and bcrypt work at any moment. The attempt is reserved before bcrypt runs,
 * so parallel guesses cannot pass the check together, and a successful login gives it back.
 * There is deliberately no global failure count: a small pool of addresses could use it to lock the owner out.
 * Logs never contain client addresses, as the privacy notice promises.
 * Create with {@code new}: a bean of this type would also be registered as a servlet filter.
 */
class LoginRateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(LoginRateLimitFilter.class);
    private static final String FORWARDED_FOR = "X-Forwarded-For";

    private final RequestMatcher loginRequest;
    private final FixedWindowRateLimiter perClient;
    private final Semaphore bcryptSlots;

    LoginRateLimitFilter(RequestMatcher loginRequest, FixedWindowRateLimiter perClient, int maxConcurrentLogins) {
        this.loginRequest = loginRequest;
        this.perClient = perClient;
        this.bcryptSlots = new Semaphore(maxConcurrentLogins);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !loginRequest.matches(request);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        warnIfProxyIsNotTrusted(request);
        String client = ClientKey.of(request.getRemoteAddr());

        Decision decision = perClient.tryAcquire(client);
        if (!decision.allowed()) {
            log.warn("A client reached the failed login limit.");
            long seconds = Math.max(1, decision.retryAfter().toSeconds());
            reject(response, seconds, "Too many failed login attempts. Try again in " + seconds + " seconds.");
            return;
        }

        if (!bcryptSlots.tryAcquire()) {
            perClient.release(client);
            reject(response, 1, "The login service is busy. Try again in a moment.");
            return;
        }
        try {
            chain.doFilter(request, response);
        } finally {
            bcryptSlots.release();
        }

        if (response.getStatus() == HttpStatus.NO_CONTENT.value()) {
            perClient.release(client);
        }
    }

    /**
     * Tomcat removes the header once it trusts the sender. If the header survives, TRUSTED_PROXY is wrong and
     * every visitor shares one limit, so one person could keep the owner locked out.
     */
    private static void warnIfProxyIsNotTrusted(HttpServletRequest request) {
        if (request.getHeader(FORWARDED_FOR) != null) {
            log.error("{} was not processed. TRUSTED_PROXY does not match the address of the reverse proxy.",
                    FORWARDED_FOR);
        }
    }

    private static void reject(HttpServletResponse response, long retryAfterSeconds, String detail) throws IOException {
        response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds));
        ProblemWriter.write(response, HttpStatus.TOO_MANY_REQUESTS, detail);
    }
}
