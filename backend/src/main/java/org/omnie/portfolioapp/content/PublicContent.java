package org.omnie.portfolioapp.content;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/** Everything the public site shows, in one language. */
public record PublicContent(
        @NotNull ProfileView profile,
        @NotNull List<ExperienceView> experiences,
        @NotNull List<SkillGroupView> skillGroups,
        @NotNull List<CredentialView> credentials,
        @NotNull List<ProjectView> projects) {

    public record ProfileView(
            @NotNull String fullName,
            @NotNull String headline,
            @NotNull String summary,
            @NotNull String location,
            String linkedinUrl,
            String githubUrl,
            String publicEmail) {
    }

    public record ExperienceView(
            @NotNull Long id,
            @NotNull String employer,
            String client,
            @NotNull String role,
            String location,
            @NotNull @Schema(pattern = "^\\d{4}-\\d{2}$", example = "2021-04") String start,
            @Schema(pattern = "^\\d{4}-\\d{2}$", description = "Null for the current role") String end,
            @NotNull List<String> achievements) {
    }

    public record SkillGroupView(@NotNull String name, @NotNull List<String> skills) {
    }

    public record CredentialView(
            @NotNull Credential.Kind kind,
            @NotNull String title,
            @NotNull String issuer,
            Integer startYear,
            Integer endYear,
            String url) {
    }

    public record ProjectView(
            @NotNull String slug,
            @NotNull String name,
            @NotNull String summary,
            @NotNull Project.Status status,
            @NotNull List<String> tech,
            String repoUrl,
            String liveUrl) {
    }
}
