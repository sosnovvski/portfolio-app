package org.omnie.portfolioapp.security;

import org.junit.jupiter.api.Test;
import org.omnie.portfolioapp.TestcontainersConfig;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Runs through real Tomcat with the test client standing in for Caddy, because limits are only as good as the
 * client address Tomcat derives from X-Forwarded-For. MockMvc tests set that address directly.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "server.tomcat.remoteip.internal-proxies=127.0.0.1/32, 0:0:0:0:0:0:0:1/128")
@ActiveProfiles("test")
@Import(TestcontainersConfig.class)
class TrustedProxyHttpIT {

    @LocalServerPort
    private int port;

    private final HttpClient http = HttpClient.newHttpClient();

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
    }

    private int login(String password, String forwardedFor) throws Exception {
        HttpResponse<String> session = http.send(request("/api/auth/session").build(),
                HttpResponse.BodyHandlers.ofString());
        String cookie = session.headers().allValues("Set-Cookie").stream()
                .filter(value -> value.startsWith("XSRF-TOKEN="))
                .findFirst().orElseThrow()
                .split(";", 2)[0];

        return http.send(request("/api/auth/login")
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .header("Cookie", cookie)
                        .header("X-XSRF-TOKEN", cookie.split("=", 2)[1])
                        .header("X-Forwarded-For", forwardedFor)
                        .POST(HttpRequest.BodyPublishers.ofString("username=admin&password=" + password))
                        .build(),
                HttpResponse.BodyHandlers.ofString()).statusCode();
    }

    @Test
    void visitorsBehindTheProxyHaveSeparateLimits() throws Exception {
        for (int i = 0; i < 5; i++) {
            assertEquals(401, login("wrong", "203.0.113.1"));
        }
        assertEquals(429, login("test-admin-password", "203.0.113.1"));

        assertEquals(204, login("test-admin-password", "203.0.113.2"));
    }

    @Test
    void spoofedLeftmostValueDoesNotEscapeTheLimit() throws Exception {
        for (int i = 0; i < 5; i++) {
            assertEquals(401, login("wrong", "198.51.100." + i + ", 203.0.113.50"));
        }

        assertEquals(429, login("test-admin-password", "198.51.100.99, 203.0.113.50"));
    }
}
