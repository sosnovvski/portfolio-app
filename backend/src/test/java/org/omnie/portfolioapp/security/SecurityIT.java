package org.omnie.portfolioapp.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.omnie.portfolioapp.IntegrationTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.concurrent.atomic.AtomicInteger;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class SecurityIT {

    private static final String LOGIN = "/api/auth/login";
    private static final String PASSWORD = "test-admin-password";
    /** Each test logs in from its own address, so limiter state cannot leak between tests. */
    private static final AtomicInteger NEXT_ADDRESS = new AtomicInteger(1);

    @Autowired
    private MockMvc mvc;

    private static RequestPostProcessor from(String address) {
        return request -> {
            request.setRemoteAddr(address);
            return request;
        };
    }

    private static String newAddress() {
        return "198.51.100." + NEXT_ADDRESS.getAndIncrement();
    }

    private MockHttpServletRequestBuilder login(String password, String address) {
        return post(LOGIN)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .param("username", "admin")
                .param("password", password)
                .with(from(address));
    }

    /** Every admin route. A new route must be added here to count as covered. */
    private static final String ADMIN_ROUTES = """
            GET,/api/admin/profile
            PUT,/api/admin/profile
            GET,/api/admin/experiences
            POST,/api/admin/experiences
            PUT,/api/admin/experiences/1
            DELETE,/api/admin/experiences/1
            GET,/api/admin/skill-groups
            POST,/api/admin/skill-groups
            PUT,/api/admin/skill-groups/1
            DELETE,/api/admin/skill-groups/1
            GET,/api/admin/credentials
            POST,/api/admin/credentials
            PUT,/api/admin/credentials/1
            DELETE,/api/admin/credentials/1
            GET,/api/admin/projects
            POST,/api/admin/projects
            PUT,/api/admin/projects/1
            DELETE,/api/admin/projects/1
            GET,/api/admin/messages
            PATCH,/api/admin/messages/1
            DELETE,/api/admin/messages/1
            """;

    @ParameterizedTest
    @CsvSource(textBlock = ADMIN_ROUTES)
    void adminRouteWithoutSessionIsProblemUnauthorized(String method, String path) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), path).with(csrf()))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.title").value("Unauthorized"))
                .andExpect(jsonPath("$.detail").isNotEmpty());
    }

    @ParameterizedTest
    @CsvSource(textBlock = """
            PUT,/api/admin/profile
            POST,/api/admin/experiences
            PUT,/api/admin/experiences/1
            DELETE,/api/admin/experiences/1
            POST,/api/admin/skill-groups
            PUT,/api/admin/skill-groups/1
            DELETE,/api/admin/skill-groups/1
            POST,/api/admin/credentials
            PUT,/api/admin/credentials/1
            DELETE,/api/admin/credentials/1
            POST,/api/admin/projects
            PUT,/api/admin/projects/1
            DELETE,/api/admin/projects/1
            PATCH,/api/admin/messages/1
            DELETE,/api/admin/messages/1
            """)
    void adminWriteWithoutCsrfTokenIsProblemForbidden(String method, String path) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), path).with(user("admin").roles("ADMIN")))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void loginWithoutCsrfTokenDoesNotUseAnAttempt() throws Exception {
        String address = newAddress();
        for (int i = 0; i < 6; i++) {
            mvc.perform(login("wrong", address)).andExpect(status().isForbidden());
        }
        mvc.perform(login(PASSWORD, address).with(csrf())).andExpect(status().isNoContent());
    }

    @Test
    void wrongPasswordIsProblemUnauthorized() throws Exception {
        mvc.perform(login("wrong", newAddress()).with(csrf()))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void sixthFailedLoginIsProblemTooManyRequests() throws Exception {
        String address = newAddress();
        for (int i = 0; i < 5; i++) {
            mvc.perform(login("wrong", address).with(csrf())).andExpect(status().isUnauthorized());
        }

        mvc.perform(login(PASSWORD, address).with(csrf()))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(429));
    }

    @Test
    void successfulLoginDoesNotCountAsFailure() throws Exception {
        String address = newAddress();
        for (int i = 0; i < 4; i++) {
            mvc.perform(login("wrong", address).with(csrf())).andExpect(status().isUnauthorized());
        }
        for (int i = 0; i < 3; i++) {
            mvc.perform(login(PASSWORD, address).with(csrf())).andExpect(status().isNoContent());
        }
        mvc.perform(login("wrong", address).with(csrf())).andExpect(status().isUnauthorized());
    }

    @Test
    void healthIsPublicButOtherActuatorEndpointsAreNot() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
        mvc.perform(get("/actuator/env").with(user("admin").roles("ADMIN"))).andExpect(status().isForbidden());
    }

    @Test
    void unknownPathsAreDeniedEvenForAdmin() throws Exception {
        mvc.perform(get("/api/unknown").with(user("admin").roles("ADMIN"))).andExpect(status().isForbidden());
    }

    @Test
    void publicContentNeedsNoLogin() throws Exception {
        mvc.perform(get("/api/public/content/de"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }
}
