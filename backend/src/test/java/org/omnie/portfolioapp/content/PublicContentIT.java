package org.omnie.portfolioapp.content;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.omnie.portfolioapp.IntegrationTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
@Sql(scripts = "/fixtures/clear.sql")
class PublicContentIT {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @Sql(scripts = {"/fixtures/clear.sql", "/fixtures/content.sql"})
    void servesPublishedContentInOrder() throws Exception {
        mvc.perform(get("/api/public/content/en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.fullName").value("Test Person"))
                .andExpect(jsonPath("$.profile.headline").value("Fixture headline"))
                .andExpect(jsonPath("$.profile.githubUrl").value(nullValue()))
                .andExpect(jsonPath("$.experiences", hasSize(2)))
                .andExpect(jsonPath("$.experiences[0].employer").value("Newer Fixture Co"))
                .andExpect(jsonPath("$.experiences[0].start").value("2021-04"))
                .andExpect(jsonPath("$.experiences[0].end").value(nullValue()))
                .andExpect(jsonPath("$.experiences[1].client").value("Fixture Client"))
                .andExpect(jsonPath("$.experiences[1].end").value("2021-03"))
                .andExpect(jsonPath("$.experiences[1].achievements", contains("First", "Second")))
                .andExpect(jsonPath("$.skillGroups[0].skills", contains("Alpha", "Beta")))
                .andExpect(jsonPath("$.credentials[0].kind").value("CERTIFICATION"))
                .andExpect(jsonPath("$.projects", hasSize(1)))
                .andExpect(jsonPath("$.projects[0].status").value("LIVE"))
                .andExpect(jsonPath("$.projects[0].tech", contains("Java", "SQL")));
    }

    @Test
    @Sql(scripts = {"/fixtures/clear.sql", "/fixtures/content.sql"})
    void servesPolishVersion() throws Exception {
        mvc.perform(get("/api/public/content/pl"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.headline").value("Nagłówek testowy"))
                .andExpect(jsonPath("$.experiences[1].achievements", contains("Pierwsze", "Drugie")));
    }

    @Test
    void missingProfileIsProblemNotFound() throws Exception {
        mvc.perform(get("/api/public/content/en"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "INSERT INTO profile (id, full_name, headline_en, headline_pl, summary_en, summary_pl, location_en, location_pl) VALUES (2, 'x', 'x', 'x', 'x', 'x', 'x', 'x')",
            "INSERT INTO profile (id, full_name, headline_en, headline_pl, summary_en, summary_pl, location_en, location_pl, github_url) VALUES (1, 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'javascript:alert(1)')",
            "INSERT INTO experience (employer, role_en, role_pl, start_month) VALUES ('x', 'x', 'x', '2021-04-15')",
            "INSERT INTO experience (employer, role_en, role_pl, start_month, end_month) VALUES ('x', 'x', 'x', '2021-04-01', '2021-03-01')",
            "INSERT INTO project (slug, name_en, name_pl, summary_en, summary_pl, status, sort_order) VALUES ('Bad Slug', 'x', 'x', 'x', 'x', 'LIVE', 0)",
            "INSERT INTO project (slug, name_en, name_pl, summary_en, summary_pl, status, sort_order) VALUES ('ok', 'x', 'x', 'x', 'x', 'UNKNOWN', 0)",
            "INSERT INTO credential (kind, title_en, title_pl, issuer, sort_order, url) VALUES ('EDUCATION', 'x', 'x', 'x', 0, 'http://insecure.test')",
            "INSERT INTO contact_message (name, email, message, locale) VALUES ('x', 'not-an-email', 'x', 'en')",
            "INSERT INTO contact_message (name, email, message, locale) VALUES ('x', 'a@b.test', '   ', 'en')"
    })
    void databaseRejectsInvalidRows(String sql) {
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(sql));
    }
}
