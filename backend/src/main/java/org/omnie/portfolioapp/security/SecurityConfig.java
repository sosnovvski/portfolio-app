package org.omnie.portfolioapp.security;

import jakarta.servlet.DispatcherType;
import org.omnie.portfolioapp.common.error.ProblemWriter;
import org.omnie.portfolioapp.common.ratelimit.FixedWindowRateLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.security.autoconfigure.actuate.web.servlet.EndpointRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

import java.time.Clock;
import java.time.Duration;

@Configuration
@EnableConfigurationProperties(AdminProperties.class)
class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    private static final String LOGIN_PATH = "/api/auth/login";
    private static final String LOGOUT_PATH = "/api/auth/logout";
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);
    private static final int LOGIN_FAILURES_PER_CLIENT = 5;
    /** Caps the CPU that bcrypt can use at any moment. */
    private static final int MAX_CONCURRENT_LOGINS = 2;

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    UserDetailsService userDetailsService(AdminProperties properties) {
        AdminProperties admin = properties.requireValid();
        return new InMemoryUserDetailsManager(User.withUsername(admin.username())
                .password(admin.passwordHash())
                .roles("ADMIN")
                .build());
    }

    /**
     * Public traffic gets no session, no CSRF token and no cookies at all. The privacy notice and the
     * absence of a cookie banner rely on this.
     */
    @Bean
    @Order(1)
    SecurityFilterChain publicFilterChain(HttpSecurity http) throws Exception {
        return http
                .securityMatchers(matchers -> matchers
                        .requestMatchers(EndpointRequest.to("health"))
                        // Serves nothing in production, where springdoc is disabled.
                        .requestMatchers("/api/public/**", "/v3/api-docs", "/v3/api-docs/**"))
                .authorizeHttpRequests(requests -> requests.anyRequest().permitAll())
                .csrf(csrf -> csrf.disable())
                .requestCache(cache -> cache.disable())
                .securityContext(context -> context.disable())
                .sessionManagement(session -> session.disable())
                .anonymous(anonymous -> anonymous.disable())
                .build();
    }

    @Bean
    @Order(2)
    SecurityFilterChain adminFilterChain(HttpSecurity http, Clock clock) throws Exception {
        LoginRateLimitFilter loginLimit = new LoginRateLimitFilter(
                PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, LOGIN_PATH),
                new FixedWindowRateLimiter(LOGIN_FAILURES_PER_CLIENT, LOGIN_WINDOW, clock),
                MAX_CONCURRENT_LOGINS);

        return http
                .authorizeHttpRequests(requests -> requests
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/session").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().denyAll())
                .csrf(csrf -> csrf.spa())
                // Caddy sets HSTS once for the whole site, including pages Spring never serves.
                .headers(headers -> headers.httpStrictTransportSecurity(hsts -> hsts.disable()))
                // A saved request would create a session for every anonymous visitor.
                .requestCache(cache -> cache.disable())
                .formLogin(form -> form
                        // Naming a page also turns off Spring's generated login page.
                        .loginPage(LOGIN_PATH)
                        .loginProcessingUrl(LOGIN_PATH)
                        .successHandler((request, response, authentication) ->
                                response.setStatus(HttpStatus.NO_CONTENT.value()))
                        .failureHandler((request, response, exception) -> {
                            log.info("Failed admin login.");
                            ProblemWriter.write(response, HttpStatus.UNAUTHORIZED, "Wrong username or password.");
                        }))
                .logout(logout -> logout
                        .logoutUrl(LOGOUT_PATH)
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) ->
                                ProblemWriter.write(response, HttpStatus.UNAUTHORIZED, "Log in to access this resource."))
                        .accessDeniedHandler((request, response, exception) ->
                                ProblemWriter.write(response, HttpStatus.FORBIDDEN,
                                        "This request is not allowed. Reload the page and try again.")))
                .addFilterBefore(loginLimit, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}
