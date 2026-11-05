package org.omnie.portfolioapp.content;

import org.junit.jupiter.api.Test;
import org.omnie.portfolioapp.common.error.NotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PublicContentController.class)
@AutoConfigureMockMvc(addFilters = false)
class PublicContentControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private PublicContentService service;

    @Test
    void returnsContentInRequestedLanguage() throws Exception {
        given(service.load(Language.PL)).willReturn(new PublicContent(
                new PublicContent.ProfileView("Test Person", "Nagłówek", "Opis", "Gdańsk", null, null, null),
                List.of(new PublicContent.ExperienceView(
                        1L, "Acme", null, "Tester", null, "2021-04", null, List.of("Pisanie testów"))),
                List.of(), List.of(), List.of()));

        mvc.perform(get("/api/public/content/pl"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.profile.headline").value("Nagłówek"))
                .andExpect(jsonPath("$.experiences[0].start").value("2021-04"))
                .andExpect(jsonPath("$.experiences[0].achievements[0]").value("Pisanie testów"));
    }

    @Test
    void unsupportedLocaleIsProblemNotFound() throws Exception {
        mvc.perform(get("/api/public/content/de"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(404));
        verifyNoInteractions(service);
    }

    @Test
    void missingProfileIsProblemNotFound() throws Exception {
        given(service.load(Language.EN)).willThrow(new NotFoundException("The profile has not been created yet."));

        mvc.perform(get("/api/public/content/en"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value(containsString("profile")));
    }
}
