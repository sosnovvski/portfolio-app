package org.omnie.portfolioapp;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fails when the API drifts from the committed contract.
 * Regenerate with: ./mvnw verify -Dit.test=OpenApiContractIT -Dcontract.update=true
 */
@SpringBootTest(properties = "springdoc.api-docs.enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfig.class)
class OpenApiContractIT {

    private static final Path CONTRACT = Path.of("..", "contracts", "openapi.json");

    @Autowired
    private MockMvc mvc;

    @Test
    void apiMatchesCommittedContract() throws Exception {
        JsonMapper mapper = JsonMapper.builder().enable(SerializationFeature.INDENT_OUTPUT).build();
        String body = mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode actual = mapper.readTree(body);
        // The server URL depends on the test environment, so it is not part of the contract.
        ((ObjectNode) actual).remove("servers");

        if (Boolean.getBoolean("contract.update")) {
            Files.createDirectories(CONTRACT.getParent());
            Files.writeString(CONTRACT, mapper.writeValueAsString(actual) + System.lineSeparator());
        }

        assertTrue(Files.exists(CONTRACT), "Missing contract. Run with -Dcontract.update=true");
        assertEquals(mapper.readTree(Files.readString(CONTRACT)), actual,
                "API differs from contracts/openapi.json. Review the change and regenerate with -Dcontract.update=true");
    }
}
