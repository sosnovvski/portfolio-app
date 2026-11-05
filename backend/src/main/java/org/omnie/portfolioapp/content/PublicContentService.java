package org.omnie.portfolioapp.content;

import org.omnie.portfolioapp.common.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.YearMonth;

@Service
public class PublicContentService {

    private final ProfileRepository profiles;
    private final ExperienceRepository experiences;
    private final SkillGroupRepository skillGroups;
    private final CredentialRepository credentials;
    private final ProjectRepository projects;

    PublicContentService(ProfileRepository profiles,
                         ExperienceRepository experiences,
                         SkillGroupRepository skillGroups,
                         CredentialRepository credentials,
                         ProjectRepository projects) {
        this.profiles = profiles;
        this.experiences = experiences;
        this.skillGroups = skillGroups;
        this.credentials = credentials;
        this.projects = projects;
    }

    @Transactional(readOnly = true)
    public PublicContent load(Language language) {
        Profile profile = profiles.findById(Profile.SINGLE_ROW_ID)
                .orElseThrow(() -> new NotFoundException("The profile has not been created yet."));

        return new PublicContent(
                new PublicContent.ProfileView(
                        profile.getFullName(),
                        profile.headline(language),
                        profile.summary(language),
                        profile.location(language),
                        profile.getLinkedinUrl(),
                        profile.getGithubUrl(),
                        profile.getPublicEmail()),
                experiences.findByPublishedTrueOrderByStartMonthDescIdDesc().stream()
                        .map(e -> new PublicContent.ExperienceView(
                                e.getId(),
                                e.getEmployer(),
                                e.getClient(),
                                e.role(language),
                                e.location(language),
                                format(e.getStartMonth()),
                                format(e.getEndMonth()),
                                e.getAchievements().stream().map(a -> a.text(language)).toList()))
                        .toList(),
                skillGroups.findAllByOrderBySortOrderAscIdAsc().stream()
                        .map(g -> new PublicContent.SkillGroupView(
                                g.name(language),
                                g.getSkills().stream().map(Skill::getName).toList()))
                        .toList(),
                credentials.findAllByOrderBySortOrderAscIdAsc().stream()
                        .map(c -> new PublicContent.CredentialView(
                                c.getKind(),
                                c.title(language),
                                c.getIssuer(),
                                c.getStartYear(),
                                c.getEndYear(),
                                c.getUrl()))
                        .toList(),
                projects.findByPublishedTrueOrderBySortOrderAscIdAsc().stream()
                        .map(p -> new PublicContent.ProjectView(
                                p.getSlug(),
                                p.name(language),
                                p.summary(language),
                                p.getStatus(),
                                p.getTech(),
                                p.getRepoUrl(),
                                p.getLiveUrl()))
                        .toList());
    }

    private static String format(YearMonth month) {
        return month == null ? null : month.toString();
    }
}
