package org.omnie.portfolioapp.content;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Admin views carry both languages and are used for requests and responses. On create, {@code id} and
 * {@code version} are ignored. On update, {@code version} must match the stored one.
 */
public final class AdminContent {

    private static final String HTTPS_URL = "^https://\\S+$";
    private static final String HTTPS_MESSAGE = "must be a full https:// address";
    private static final String MONTH = "^\\d{4}-(0[1-9]|1[0-2])$";
    private static final String MONTH_MESSAGE = "must look like 2021-04";
    /** Matches the database check, so a value @Email accepts cannot fail later as a conflict. */
    private static final String SIMPLE_EMAIL = "^[^@\\s]+@[^@\\s]+$";
    private static final int MAX_LONG_TEXT = 10_000;

    private AdminContent() {
    }

    public record ProfileForm(
            Long version,
            @NotBlank @Size(max = 120) String fullName,
            @NotBlank @Size(max = 200) String headlineEn,
            @NotBlank @Size(max = 200) String headlinePl,
            @NotBlank @Size(max = MAX_LONG_TEXT) String summaryEn,
            @NotBlank @Size(max = MAX_LONG_TEXT) String summaryPl,
            @NotBlank @Size(max = 120) String locationEn,
            @NotBlank @Size(max = 120) String locationPl,
            @Size(max = 300) @Pattern(regexp = HTTPS_URL, message = HTTPS_MESSAGE) String linkedinUrl,
            @Size(max = 300) @Pattern(regexp = HTTPS_URL, message = HTTPS_MESSAGE) String githubUrl,
            @Size(max = 254) @Email @Pattern(regexp = SIMPLE_EMAIL, message = "must be a valid email address") String publicEmail) {
    }

    public record ExperienceForm(
            Long id,
            Long version,
            @NotBlank @Size(max = 150) String employer,
            @Size(max = 150) String client,
            @NotBlank @Size(max = 150) String roleEn,
            @NotBlank @Size(max = 150) String rolePl,
            @Size(max = 120) String locationEn,
            @Size(max = 120) String locationPl,
            @NotNull @Pattern(regexp = MONTH, message = MONTH_MESSAGE) String start,
            @Pattern(regexp = MONTH, message = MONTH_MESSAGE) String end,
            @NotNull Boolean published,
            @NotNull @Size(max = 50) List<@NotNull @Valid AchievementForm> achievements) {

        @JsonIgnore
        @Schema(hidden = true)
        @AssertTrue(message = "must not be before the start month")
        public boolean isEndValid() {
            // Both values have the fixed YYYY-MM format, so text order equals date order.
            return start == null || end == null || end.compareTo(start) >= 0;
        }
    }

    public record AchievementForm(
            @NotBlank @Size(max = 1000) String textEn,
            @NotBlank @Size(max = 1000) String textPl) {
    }

    public record SkillGroupForm(
            Long id,
            Long version,
            @NotBlank @Size(max = 100) String nameEn,
            @NotBlank @Size(max = 100) String namePl,
            @NotNull @Min(0) Integer sortOrder,
            @NotNull @Size(max = 100) List<@NotBlank @Size(max = 100) String> skills) {
    }

    public record CredentialForm(
            Long id,
            Long version,
            @NotNull Credential.Kind kind,
            @NotBlank @Size(max = 200) String titleEn,
            @NotBlank @Size(max = 200) String titlePl,
            @NotBlank @Size(max = 200) String issuer,
            @Min(1950) @Max(2100) Integer startYear,
            @Min(1950) @Max(2100) Integer endYear,
            @Size(max = 300) @Pattern(regexp = HTTPS_URL, message = HTTPS_MESSAGE) String url,
            @NotNull @Min(0) Integer sortOrder) {

        @JsonIgnore
        @Schema(hidden = true)
        @AssertTrue(message = "must not be before the start year")
        public boolean isEndYearValid() {
            return startYear == null || endYear == null || endYear >= startYear;
        }
    }

    public record ProjectForm(
            Long id,
            Long version,
            @NotBlank @Size(max = 100)
            @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$", message = "must use lowercase letters, digits and hyphens")
            String slug,
            @NotBlank @Size(max = 150) String nameEn,
            @NotBlank @Size(max = 150) String namePl,
            @NotBlank @Size(max = MAX_LONG_TEXT) String summaryEn,
            @NotBlank @Size(max = MAX_LONG_TEXT) String summaryPl,
            @NotNull Project.Status status,
            @NotNull @Size(max = 30) List<@NotBlank @Size(max = 60) String> tech,
            @Size(max = 300) @Pattern(regexp = HTTPS_URL, message = HTTPS_MESSAGE) String repoUrl,
            @Size(max = 300) @Pattern(regexp = HTTPS_URL, message = HTTPS_MESSAGE) String liveUrl,
            @NotNull @Min(0) Integer sortOrder,
            @NotNull Boolean published) {
    }
}
