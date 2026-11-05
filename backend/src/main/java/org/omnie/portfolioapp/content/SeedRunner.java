package org.omnie.portfolioapp.content;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Fills an empty database once. An existing profile means content is already managed in the admin panel,
 * so nothing is overwritten. Any invalid seed stops the application with no partial import.
 */
@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
class SeedRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedRunner.class);

    private final Path file;
    private final ProfileRepository profiles;
    private final AdminContentService content;
    private final Validator validator;
    private final JsonMapper json;
    private final TransactionTemplate transaction;

    SeedRunner(@Value("${app.seed.file}") Path file,
               ProfileRepository profiles,
               AdminContentService content,
               Validator validator,
               JsonMapper json,
               TransactionTemplate transaction) {
        this.file = file;
        this.profiles = profiles;
        this.content = content;
        this.validator = validator;
        this.json = json;
        this.transaction = transaction;
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        if (profiles.existsById(Profile.SINGLE_ROW_ID)) {
            log.info("Content already exists, skipping the seed.");
            return;
        }

        SeedFile seed = json.readValue(Files.readString(file), SeedFile.class);
        Set<ConstraintViolation<SeedFile>> violations = validator.validate(seed);
        if (!violations.isEmpty()) {
            throw new IllegalStateException("Invalid seed file: " + violations.stream()
                    .map(violation -> violation.getPropertyPath() + " " + violation.getMessage())
                    .collect(Collectors.joining("; ")));
        }

        transaction.executeWithoutResult(status -> {
            content.saveProfile(seed.profile());
            seed.experiences().forEach(content::createExperience);
            seed.skillGroups().forEach(content::createSkillGroup);
            seed.credentials().forEach(content::createCredential);
            seed.projects().forEach(content::createProject);
        });
        log.info("Imported the seed: {} roles, {} projects.", seed.experiences().size(), seed.projects().size());
    }
}
