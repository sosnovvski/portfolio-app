package org.omnie.portfolioapp.content;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.omnie.portfolioapp.content.AdminContent.CredentialForm;
import org.omnie.portfolioapp.content.AdminContent.ExperienceForm;
import org.omnie.portfolioapp.content.AdminContent.ProfileForm;
import org.omnie.portfolioapp.content.AdminContent.ProjectForm;
import org.omnie.portfolioapp.content.AdminContent.SkillGroupForm;

import java.util.List;

/** Initial content, checked with the same rules as edits in the admin panel. */
public record SeedFile(
        @NotNull @Valid ProfileForm profile,
        @NotNull List<@NotNull @Valid ExperienceForm> experiences,
        @NotNull List<@NotNull @Valid SkillGroupForm> skillGroups,
        @NotNull List<@NotNull @Valid CredentialForm> credentials,
        @NotNull List<@NotNull @Valid ProjectForm> projects) {
}
