package org.omnie.portfolioapp.contact;

import org.junit.jupiter.api.Test;
import org.omnie.portfolioapp.IntegrationTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.concurrent.atomic.AtomicInteger;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
@Sql(scripts = "/fixtures/clear.sql")
class ContactIT {

    private static final AtomicInteger NEXT_ADDRESS = new AtomicInteger(1);
    private static final String VALID = """
            {"name": "Visitor", "email": "visitor@example.test", "message": "A message long enough.", "locale": "pl"}""";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ContactRetentionJob retentionJob;

    private static RequestPostProcessor from(String address) {
        return request -> {
            request.setRemoteAddr(address);
            return request;
        };
    }

    private static String newAddress() {
        return "192.0.2." + NEXT_ADDRESS.getAndIncrement();
    }

    private ResultActions submit(String json, String address) throws Exception {
        return mvc.perform(post("/api/public/contact")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json)
                .with(from(address)));
    }

    private int storedMessages() {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM contact_message", Integer.class);
        return count == null ? 0 : count;
    }

    @Test
    void messageReachesAdminInboxWithoutCsrfOrSession() throws Exception {
        submit(VALID, newAddress()).andExpect(status().isAccepted());

        mvc.perform(get("/api/admin/messages").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].name").value("Visitor"))
                .andExpect(jsonPath("$.items[0].locale").value("pl"))
                .andExpect(jsonPath("$.items[0].createdAt", notNullValue()))
                .andExpect(jsonPath("$.items[0].readAt", nullValue()));
    }

    @Test
    void noColumnCanHoldTheSendersAddress() {
        Integer columns = jdbc.queryForObject("""
                SELECT count(*) FROM information_schema.columns
                WHERE table_name = 'contact_message' AND column_name ~* 'ip|addr|agent'
                """, Integer.class);

        assertEquals(0, columns);
    }

    @Test
    void honeypotGetsSameResponseAndStoresNothing() throws Exception {
        submit("""
                {"name": "Bot", "email": "b@example.test", "message": "Buy things right now.", "locale": "en",
                 "contactRef": "https://spam.test"}""", newAddress())
                .andExpect(status().isAccepted())
                .andExpect(content().string(""));

        assertEquals(0, storedMessages());
    }

    @Test
    void invalidMessageIsProblemWithFieldErrors() throws Exception {
        submit("""
                {"name": "", "email": "nope", "message": "short", "locale": "de"}""", newAddress())
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.errors[*].field", hasItem("email")))
                .andExpect(jsonPath("$.errors[*].field", hasItem("locale")));

        assertEquals(0, storedMessages());
    }

    @Test
    void nulCharactersAreRemovedInsteadOfCausingAServerError() throws Exception {
        submit("""
                {"name": "Vis\\u0000itor", "email": "v@example.test", "message": "A message long enough.", "locale": "en"}""", newAddress())
                .andExpect(status().isAccepted());

        assertEquals("Visitor", jdbc.queryForObject("SELECT name FROM contact_message", String.class));
    }

    @Test
    void quotedEmailThatDatabaseWouldRejectIsAFieldError() throws Exception {
        submit("""
                {"name": "Visitor", "email": "\\"a b\\"@example.test", "message": "A message long enough.", "locale": "en"}""", newAddress())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", hasItem("email")));
    }

    @Test
    void sixthMessageInAnHourIsProblemTooManyRequests() throws Exception {
        String address = newAddress();
        for (int i = 0; i < 5; i++) {
            submit(VALID, address).andExpect(status().isAccepted());
        }

        submit(VALID, address)
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        assertEquals(5, storedMessages());
    }

    @Test
    void adminCanMarkReadUnreadAndDelete() throws Exception {
        submit(VALID, newAddress()).andExpect(status().isAccepted());
        Long id = jdbc.queryForObject("SELECT id FROM contact_message", Long.class);

        mvc.perform(patch("/api/admin/messages/" + id)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"read\": true}")
                        .with(user("admin").roles("ADMIN")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readAt", notNullValue()));

        mvc.perform(patch("/api/admin/messages/" + id)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"read\": false}")
                        .with(user("admin").roles("ADMIN")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readAt", nullValue()));

        mvc.perform(delete("/api/admin/messages/" + id).with(user("admin").roles("ADMIN")).with(csrf()))
                .andExpect(status().isNoContent());

        mvc.perform(delete("/api/admin/messages/" + id).with(user("admin").roles("ADMIN")).with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void inboxIsPagedNewestFirst() throws Exception {
        for (int i = 1; i <= 3; i++) {
            jdbc.update("""
                    INSERT INTO contact_message (name, email, message, locale, created_at)
                    VALUES (?, 'v@example.test', 'A message long enough.', 'en', now() - make_interval(days => ?))
                    """, "Age" + i, i);
        }

        mvc.perform(get("/api/admin/messages").param("page", "0").param("size", "2").with(user("admin").roles("ADMIN")))
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].name").value("Age1"));

        mvc.perform(get("/api/admin/messages").param("page", "1").param("size", "2").with(user("admin").roles("ADMIN")))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].name").value("Age3"));
    }

    @Test
    void retentionJobDeletesOnlyMessagesOlderThanTwelveMonths() {
        jdbc.update("""
                INSERT INTO contact_message (name, email, message, locale, created_at) VALUES
                    ('Old', 'o@example.test', 'A message long enough.', 'en', now() - interval '12 months 1 day'),
                    ('Recent', 'r@example.test', 'A message long enough.', 'en', now() - interval '11 months 28 days')
                """);

        retentionJob.deleteExpired();

        assertEquals(1, storedMessages());
        assertEquals("Recent", jdbc.queryForObject("SELECT name FROM contact_message", String.class));
    }
}
