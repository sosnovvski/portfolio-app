package org.omnie.portfolioapp.security;

import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class SessionController {

    record SessionView(@NotNull Boolean authenticated) {
    }

    /**
     * Also makes sure the CSRF cookie exists, so the admin UI calls this on load and again after login
     * and logout, and always reads the current cookie value before a write.
     */
    @GetMapping("/api/auth/session")
    SessionView session(@Parameter(hidden = true) Authentication authentication,
                        @Parameter(hidden = true) CsrfToken csrfToken) {
        csrfToken.getToken();
        boolean authenticated = authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);
        return new SessionView(authenticated);
    }
}
