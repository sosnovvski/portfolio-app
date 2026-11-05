package org.omnie.portfolioapp.content;

import org.junit.jupiter.api.Test;
import org.omnie.portfolioapp.IntegrationTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
@Sql(scripts = "/fixtures/clear.sql")
class AdminContentIT {

    @Autowired
    private MockMvc mvc;

    private ResultActions send(MockHttpServletRequestBuilder builder, String json) throws Exception {
        return mvc.perform(builder
                .contentType(MediaType.APPLICATION_JSON)
                .content(json)
                .with(user("admin").roles("ADMIN"))
                .with(csrf()));
    }

    private static String experience(String version, String achievements, String end) {
        return """
                {"version": %s, "employer": "Fixture Co", "roleEn": "Engineer", "rolePl": "Inżynier",
                 "start": "2021-04", "end": %s, "published": true, "achievements": %s}
                """.formatted(version, end, achievements);
    }

    private static final String ONE_ACHIEVEMENT = """
            [{"textEn": "One", "textPl": "Jeden"}]""";
    private static final String TWO_ACHIEVEMENTS = """
            [{"textEn": "B", "textPl": "Be"}, {"textEn": "A", "textPl": "A"}]""";

    private static String profile(String version, String headline, String githubUrl) {
        return """
                {"version": %s, "fullName": "Test Person", "headlineEn": "%s", "headlinePl": "Nagłówek",
                 "summaryEn": "Summary", "summaryPl": "Opis", "locationEn": "Testville", "locationPl": "Testowo",
                 "githubUrl": %s}
                """.formatted(version, headline, githubUrl);
    }

    @Test
    void profileIsCreatedOnFirstSaveAndEditShowsOnPublicApi() throws Exception {
        send(put("/api/admin/profile"), profile("null", "First", "null"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(0));

        mvc.perform(get("/api/public/content/en"))
                .andExpect(jsonPath("$.profile.headline").value("First"))
                .andExpect(jsonPath("$.profile.githubUrl").doesNotExist());

        send(put("/api/admin/profile"), profile("0", "Second", "\"https://example.test/someone\""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1));

        mvc.perform(get("/api/public/content/en"))
                .andExpect(jsonPath("$.profile.headline").value("Second"))
                .andExpect(jsonPath("$.profile.githubUrl").value("https://example.test/someone"));
    }

    @Test
    void staleProfileEditIsProblemConflict() throws Exception {
        send(put("/api/admin/profile"), profile("null", "First", "null")).andExpect(status().isOk());

        send(put("/api/admin/profile"), profile("7", "Stale", "null"))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void savedProfileWithoutVersionIsConflictNotOverwrite() throws Exception {
        send(put("/api/admin/profile"), profile("null", "First", "null")).andExpect(status().isOk());

        send(put("/api/admin/profile"), profile("null", "Overwrite", "null")).andExpect(status().isConflict());

        mvc.perform(get("/api/public/content/en")).andExpect(jsonPath("$.profile.headline").value("First"));
    }

    @Test
    void childOnlyEditRaisesVersionSoStaleEditorGetsConflict() throws Exception {
        send(post("/api/admin/experiences"), experience("null", ONE_ACHIEVEMENT, "null"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.version").value(0));

        send(put("/api/admin/experiences/1"), experience("0", TWO_ACHIEVEMENTS, "null"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.achievements[0].textEn").value("B"));

        send(put("/api/admin/experiences/1"), experience("0", ONE_ACHIEVEMENT, "null"))
                .andExpect(status().isConflict());

        send(put("/api/admin/experiences/1"), experience("1", ONE_ACHIEVEMENT, "null"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.achievements", hasSize(1)));
    }

    @Test
    void achievementOrderFollowsTheSubmittedList() throws Exception {
        send(post("/api/admin/experiences"), experience("null", TWO_ACHIEVEMENTS, "null"))
                .andExpect(status().isCreated());
        send(put("/api/admin/profile"), profile("null", "H", "null")).andExpect(status().isOk());

        mvc.perform(get("/api/public/content/en"))
                .andExpect(jsonPath("$.experiences[0].achievements", contains("B", "A")));
    }

    @Test
    void deletedExperienceDisappearsAndSecondDeleteIsNotFound() throws Exception {
        send(post("/api/admin/experiences"), experience("null", ONE_ACHIEVEMENT, "null"))
                .andExpect(status().isCreated());

        send(delete("/api/admin/experiences/1"), "").andExpect(status().isNoContent());

        send(delete("/api/admin/experiences/1"), "")
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void invalidMonthRangeAndMissingFieldsListFieldErrors() throws Exception {
        send(post("/api/admin/experiences"), experience("null", ONE_ACHIEVEMENT, "\"2020-01\""))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.errors[*].field", hasItem("endValid")));

        send(post("/api/admin/experiences"), """
                {"start": "2021-13", "achievements": []}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", hasItem("employer")))
                .andExpect(jsonPath("$.errors[*].field", hasItem("start")));
    }

    @Test
    void nullAchievementAndEmptyEmailAreFieldErrors() throws Exception {
        send(post("/api/admin/experiences"), experience("null", "[null]", "null"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", hasItem("achievements[0]")));

        send(put("/api/admin/profile"), profile("null", "H", "null").replace("\"githubUrl\"", "\"publicEmail\": \"\", \"githubUrl\""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", hasItem("publicEmail")));
    }

    @Test
    void javascriptLinkIsRejectedBeforeReachingTheDatabase() throws Exception {
        send(put("/api/admin/profile"), profile("null", "H", "\"javascript:alert(1)\""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", hasItem("githubUrl")));
    }

    @Test
    void projectLifecycleWithTechAndDuplicateSlug() throws Exception {
        String project = """
                {"slug": "my-app", "nameEn": "App", "namePl": "Aplikacja", "summaryEn": "S", "summaryPl": "O",
                 "status": "PLANNED", "tech": ["Java", "SQL"], "sortOrder": 0, "published": true}""";
        send(post("/api/admin/projects"), project)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tech", contains("Java", "SQL")));

        send(post("/api/admin/projects"), project)
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        send(put("/api/admin/projects/1"), project.replace("{\"slug\"", "{\"version\": 0, \"slug\"")
                .replace("PLANNED", "LIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LIVE"))
                .andExpect(jsonPath("$.version").value(1));
    }

    @Test
    void skillGroupAndCredentialRoundTrip() throws Exception {
        send(post("/api/admin/skill-groups"), """
                {"nameEn": "Group", "namePl": "Grupa", "sortOrder": 0, "skills": ["Beta", "Alpha"]}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.skills", contains("Beta", "Alpha")));

        send(put("/api/admin/skill-groups/1"), """
                {"version": 0, "nameEn": "Group", "namePl": "Grupa", "sortOrder": 0, "skills": ["Gamma"]}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.skills", contains("Gamma")));

        send(post("/api/admin/credentials"), """
                {"kind": "EDUCATION", "titleEn": "Degree", "titlePl": "Dyplom", "issuer": "Uni",
                 "startYear": 2014, "endYear": 2018, "sortOrder": 0}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("EDUCATION"));

        send(post("/api/admin/credentials"), """
                {"kind": "EDUCATION", "titleEn": "Degree", "titlePl": "Dyplom", "issuer": "Uni",
                 "startYear": 2018, "endYear": 2014, "sortOrder": 0}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", hasItem("endYearValid")));
    }
}
