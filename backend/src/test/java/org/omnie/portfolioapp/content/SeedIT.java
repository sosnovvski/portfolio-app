package org.omnie.portfolioapp.content;

import org.junit.jupiter.api.Test;
import org.omnie.portfolioapp.TestcontainersConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"app.seed.enabled=true", "app.seed.file=../seed/content.json"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfig.class)
class SeedIT {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private SeedRunner seedRunner;

    @Test
    void realSeedImportsAndIsServedInBothLanguages() throws Exception {
        mvc.perform(get("/api/public/content/en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.fullName").value("Kamil Sosnowski"))
                .andExpect(jsonPath("$.experiences", hasSize(8)))
                .andExpect(jsonPath("$.experiences[0].end").doesNotExist())
                .andExpect(jsonPath("$.experiences[3].client").value("Thales"));

        mvc.perform(get("/api/public/content/pl"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.experiences[6].role").value("Młodszy tester"))
                .andExpect(jsonPath("$.skillGroups[*].name",
                        contains("Automatyzacja testów", "CI/CD", "Narzędzia budowania")));
    }

    @Test
    void runningAgainNeverOverwritesEditsFromTheAdminPanel() throws Exception {
        jdbc.update("UPDATE profile SET headline_en = 'Edited in the panel'");

        seedRunner.run(new DefaultApplicationArguments());

        assertEquals("Edited in the panel", jdbc.queryForObject("SELECT headline_en FROM profile", String.class));
        assertEquals(8, jdbc.queryForObject("SELECT count(*) FROM experience", Integer.class));
    }
}
