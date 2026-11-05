package org.omnie.portfolioapp.content;

import org.omnie.portfolioapp.common.error.ConflictException;
import org.omnie.portfolioapp.common.error.NotFoundException;
import org.omnie.portfolioapp.content.AdminContent.CredentialForm;
import org.omnie.portfolioapp.content.AdminContent.ExperienceForm;
import org.omnie.portfolioapp.content.AdminContent.ProfileForm;
import org.omnie.portfolioapp.content.AdminContent.ProjectForm;
import org.omnie.portfolioapp.content.AdminContent.SkillGroupForm;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/**
 * Forms are mapped after flushing, so responses carry the new version and the next edit does not get
 * a false conflict.
 */
@Service
@Transactional
public class AdminContentService {

    private final ProfileRepository profiles;
    private final ExperienceRepository experiences;
    private final SkillGroupRepository skillGroups;
    private final CredentialRepository credentials;
    private final ProjectRepository projects;

    AdminContentService(ProfileRepository profiles,
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
    public ProfileForm profile() {
        return profiles.findById(Profile.SINGLE_ROW_ID)
                .map(Profile::toForm)
                .orElseThrow(() -> new NotFoundException("The profile has not been created yet."));
    }

    /** Creates the profile on the first save. Later saves need the current version. */
    public ProfileForm saveProfile(ProfileForm form) {
        Profile profile = profiles.findById(Profile.SINGLE_ROW_ID).orElse(null);
        if (profile == null) {
            profile = new Profile();
            profile.apply(form);
            profiles.saveAndFlush(profile);
        } else {
            requireVersion(profile, form.version());
            profile.apply(form);
            profiles.flush();
        }
        return profile.toForm();
    }

    @Transactional(readOnly = true)
    public List<ExperienceForm> experiences() {
        return experiences.findAllByOrderByStartMonthDescIdDesc().stream().map(Experience::toForm).toList();
    }

    public ExperienceForm createExperience(ExperienceForm form) {
        Experience experience = new Experience();
        experience.apply(form);
        return experiences.saveAndFlush(experience).toForm();
    }

    public ExperienceForm updateExperience(long id, ExperienceForm form) {
        Experience experience = find(experiences, id);
        requireVersion(experience, form.version());
        experience.apply(form);
        experiences.flush();
        return experience.toForm();
    }

    public void deleteExperience(long id) {
        experiences.delete(find(experiences, id));
    }

    @Transactional(readOnly = true)
    public List<SkillGroupForm> skillGroups() {
        return skillGroups.findAllByOrderBySortOrderAscIdAsc().stream().map(SkillGroup::toForm).toList();
    }

    public SkillGroupForm createSkillGroup(SkillGroupForm form) {
        SkillGroup group = new SkillGroup();
        group.apply(form);
        return skillGroups.saveAndFlush(group).toForm();
    }

    public SkillGroupForm updateSkillGroup(long id, SkillGroupForm form) {
        SkillGroup group = find(skillGroups, id);
        requireVersion(group, form.version());
        group.apply(form);
        skillGroups.flush();
        return group.toForm();
    }

    public void deleteSkillGroup(long id) {
        skillGroups.delete(find(skillGroups, id));
    }

    @Transactional(readOnly = true)
    public List<CredentialForm> credentials() {
        return credentials.findAllByOrderBySortOrderAscIdAsc().stream().map(Credential::toForm).toList();
    }

    public CredentialForm createCredential(CredentialForm form) {
        Credential credential = new Credential();
        credential.apply(form);
        return credentials.saveAndFlush(credential).toForm();
    }

    public CredentialForm updateCredential(long id, CredentialForm form) {
        Credential credential = find(credentials, id);
        requireVersion(credential, form.version());
        credential.apply(form);
        credentials.flush();
        return credential.toForm();
    }

    public void deleteCredential(long id) {
        credentials.delete(find(credentials, id));
    }

    @Transactional(readOnly = true)
    public List<ProjectForm> projects() {
        return projects.findAllByOrderBySortOrderAscIdAsc().stream().map(Project::toForm).toList();
    }

    public ProjectForm createProject(ProjectForm form) {
        Project project = new Project();
        project.apply(form);
        return projects.saveAndFlush(project).toForm();
    }

    public ProjectForm updateProject(long id, ProjectForm form) {
        Project project = find(projects, id);
        requireVersion(project, form.version());
        project.apply(form);
        projects.flush();
        return project.toForm();
    }

    public void deleteProject(long id) {
        projects.delete(find(projects, id));
    }

    private static <T> T find(JpaRepository<T, Long> repository, long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("This item no longer exists."));
    }

    private static void requireVersion(AuditedEntity entity, Long submitted) {
        if (!Objects.equals(entity.getVersion(), submitted)) {
            throw new ConflictException("This item changed since you opened it. Reload it and apply your change again.");
        }
    }
}
