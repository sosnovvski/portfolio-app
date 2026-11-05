package org.omnie.portfolioapp.security;

import org.junit.jupiter.api.Test;
import org.omnie.portfolioapp.TestcontainersConfig;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Session and cookie behaviour over real HTTP against real Tomcat. MockMvc cannot show these: it does not
 * apply cookie configuration, and its csrf() helper replaces the token repository in the shared filter.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(TestcontainersConfig.class)
class SessionHttpIT {

    private static final String SESSION = "/api/auth/session";
    private static final String LOGIN_BODY = "username=admin&password=test-admin-password";

    @LocalServerPort
    private int port;

    private final HttpClient http = HttpClient.newHttpClient();

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
    }

    private HttpResponse<String> send(HttpRequest.Builder builder) throws IOException, InterruptedException {
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static Optional<String> setCookie(HttpResponse<?> response, String name) {
        // A response can delete a cookie and set a new one, so the last live value is the current one.
        return response.headers().allValues("Set-Cookie").stream()
                .filter(value -> value.startsWith(name + "="))
                .filter(value -> !value.toLowerCase().contains("max-age=0"))
                .reduce((first, second) -> second);
    }

    /** Name=value only, as a client sends it back. */
    private static String pair(String setCookieHeader) {
        return setCookieHeader.split(";", 2)[0];
    }

    private static String value(String setCookieHeader) {
        return pair(setCookieHeader).split("=", 2)[1];
    }

    private String csrfCookieHeader(String extraCookie) throws IOException, InterruptedException {
        HttpRequest.Builder builder = request(SESSION);
        if (extraCookie != null) {
            builder.header("Cookie", extraCookie);
        }
        return setCookie(send(builder), "XSRF-TOKEN")
                .orElseThrow(() -> new AssertionError("The session endpoint must issue the CSRF cookie"));
    }

    private HttpResponse<String> login(String csrfCookie, String sessionCookie) throws IOException, InterruptedException {
        String cookies = pair(csrfCookie) + (sessionCookie == null ? "" : "; " + sessionCookie);
        return send(request("/api/auth/login")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Cookie", cookies)
                .header("X-XSRF-TOKEN", value(csrfCookie))
                .POST(HttpRequest.BodyPublishers.ofString(LOGIN_BODY)));
    }

    @Test
    void anonymousAdminRequestCreatesNoSession() throws Exception {
        HttpResponse<String> response = send(request("/api/admin/profile"));

        assertEquals(401, response.statusCode());
        assertTrue(response.headers().firstValue("Content-Type").orElse("").startsWith("application/problem+json"));
        assertTrue(setCookie(response, "JSESSIONID").isEmpty());
    }

    @Test
    void formEncodedPutIsRefusedByRouting() throws Exception {
        HttpResponse<String> response = send(request("/api/public/content/en")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .PUT(HttpRequest.BodyPublishers.ofString("a=" + "x".repeat(1_000))));

        assertEquals(405, response.statusCode());
    }

    @Test
    void publicContentSetsNoCookies() throws Exception {
        HttpResponse<String> response = send(request("/api/public/content/de"));

        assertEquals(404, response.statusCode());
        assertEquals(List.of(), response.headers().allValues("Set-Cookie"));
    }

    @Test
    void sessionCookieHasProtectiveFlagsAndCsrfCookieIsReadableByScript() throws Exception {
        String csrf = csrfCookieHeader(null);
        assertFalse(csrf.toLowerCase().contains("httponly"), csrf);

        String session = setCookie(login(csrf, null), "JSESSIONID").orElseThrow();
        String flags = session.toLowerCase();
        assertTrue(flags.contains("httponly"), session);
        assertTrue(flags.contains("secure"), session);
        assertTrue(flags.contains("samesite=strict"), session);
    }

    @Test
    void attackerSuppliedSessionIdIsNotAdopted() throws Exception {
        String csrf = csrfCookieHeader(null);

        HttpResponse<String> response = login(csrf, "JSESSIONID=ATTACKERCHOSENVALUE");

        assertEquals(204, response.statusCode());
        assertNotEquals("ATTACKERCHOSENVALUE", value(setCookie(response, "JSESSIONID").orElseThrow()));
    }

    @Test
    void loginInsideExistingSessionChangesItsIdAndOldIdStopsWorking() throws Exception {
        HttpResponse<String> first = login(csrfCookieHeader(null), null);
        String firstSession = pair(setCookie(first, "JSESSIONID").orElseThrow());

        String csrf = csrfCookieHeader(firstSession);
        HttpResponse<String> second = login(csrf, firstSession);

        assertEquals(204, second.statusCode());
        String secondSession = pair(setCookie(second, "JSESSIONID").orElseThrow());
        assertNotEquals(firstSession, secondSession);
        assertEquals(401, send(request("/api/admin/experiences").header("Cookie", firstSession)).statusCode());
        assertEquals(200, send(request("/api/admin/experiences").header("Cookie", secondSession)).statusCode());
    }

    /** The real browser flow: read the CSRF cookie, log in, re-read it, use it, log out. */
    @Test
    void fullFlowWithRealCookies() throws Exception {
        HttpResponse<String> anonymous = send(request(SESSION));
        assertTrue(anonymous.body().contains("\"authenticated\":false"), anonymous.body());
        String preLogin = setCookie(anonymous, "XSRF-TOKEN").orElseThrow();

        HttpResponse<String> login = login(preLogin, null);
        assertEquals(204, login.statusCode());
        String session = pair(setCookie(login, "JSESSIONID").orElseThrow());

        String afterLogin = setCookie(login, "XSRF-TOKEN").orElseThrow();
        assertNotEquals(value(preLogin), value(afterLogin), "Login must rotate the CSRF token");

        HttpResponse<String> current = send(request(SESSION).header("Cookie", session + "; " + pair(afterLogin)));
        assertTrue(current.body().contains("\"authenticated\":true"), current.body());

        assertEquals(403, send(request("/api/auth/logout")
                .header("Cookie", session + "; " + pair(afterLogin))
                .POST(HttpRequest.BodyPublishers.noBody())).statusCode(), "Logout needs the CSRF header");

        assertEquals(204, send(request("/api/auth/logout")
                .header("Cookie", session + "; " + pair(afterLogin))
                .header("X-XSRF-TOKEN", value(afterLogin))
                .POST(HttpRequest.BodyPublishers.noBody())).statusCode());

        assertEquals(401, send(request("/api/admin/experiences").header("Cookie", session)).statusCode());
    }
}
