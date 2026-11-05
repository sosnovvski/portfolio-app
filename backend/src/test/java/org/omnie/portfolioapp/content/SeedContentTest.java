package org.omnie.portfolioapp.content;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Guards the real seed file: it must load, and must never carry private contact details. */
class SeedContentTest {

    private static final Path SEED = Path.of("..", "seed", "content.json");

    private final JsonMapper json = JsonMapper.builder().build();
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private SeedFile seed() throws Exception {
        return json.readValue(Files.readString(SEED), SeedFile.class);
    }

    @Test
    void passesTheSameValidationAsTheAdminPanel() throws Exception {
        assertEquals(Set.of(), validator.validate(seed()).stream()
                .map(violation -> violation.getPropertyPath() + " " + violation.getMessage())
                .collect(Collectors.toSet()));
    }

    @Test
    void containsNoPhoneNumber() throws Exception {
        String digitsOnly = Files.readString(SEED).replaceAll("[\\s()+-]", "");

        assertFalse(digitsOnly.matches("(?s).*\\d{9}.*"), "The seed must not contain a phone number");
    }

    @Test
    void containsNoEmailAddressOutsideTheDedicatedField() throws Exception {
        String raw = Files.readString(SEED);
        String publicEmail = seed().profile().publicEmail();
        String rest = publicEmail == null ? raw : raw.replace(publicEmail, "");

        assertFalse(rest.contains("@"), "Only profile.publicEmail may hold an email address");
    }

    @Test
    void hasExactlyOneCurrentRoleAndNoProficiencyClaims() throws Exception {
        SeedFile seed = seed();

        assertEquals(1, seed.experiences().stream().filter(role -> role.end() == null).count());
        assertNull(seed.experiences().getFirst().end());
        assertTrue(Files.readString(SEED).toLowerCase().indexOf("proficien") < 0);
    }

    @Test
    void rolesAreListedNewestFirst() throws Exception {
        var starts = seed().experiences().stream().map(AdminContent.ExperienceForm::start).toList();

        assertEquals(starts.stream().sorted(java.util.Comparator.reverseOrder()).toList(), starts);
    }
}
