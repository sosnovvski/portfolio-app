package org.omnie.portfolioapp.content;

import jakarta.validation.Valid;
import org.omnie.portfolioapp.content.AdminContent.CredentialForm;
import org.omnie.portfolioapp.content.AdminContent.ExperienceForm;
import org.omnie.portfolioapp.content.AdminContent.ProfileForm;
import org.omnie.portfolioapp.content.AdminContent.ProjectForm;
import org.omnie.portfolioapp.content.AdminContent.SkillGroupForm;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
class AdminContentController {

    private final AdminContentService service;

    AdminContentController(AdminContentService service) {
        this.service = service;
    }

    @GetMapping("/profile")
    ProfileForm profile() {
        return service.profile();
    }

    @PutMapping("/profile")
    ProfileForm saveProfile(@Valid @RequestBody ProfileForm form) {
        return service.saveProfile(form);
    }

    @GetMapping("/experiences")
    List<ExperienceForm> experiences() {
        return service.experiences();
    }

    @PostMapping("/experiences")
    @ResponseStatus(HttpStatus.CREATED)
    ExperienceForm createExperience(@Valid @RequestBody ExperienceForm form) {
        return service.createExperience(form);
    }

    @PutMapping("/experiences/{id}")
    ExperienceForm updateExperience(@PathVariable long id, @Valid @RequestBody ExperienceForm form) {
        return service.updateExperience(id, form);
    }

    @DeleteMapping("/experiences/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteExperience(@PathVariable long id) {
        service.deleteExperience(id);
    }

    @GetMapping("/skill-groups")
    List<SkillGroupForm> skillGroups() {
        return service.skillGroups();
    }

    @PostMapping("/skill-groups")
    @ResponseStatus(HttpStatus.CREATED)
    SkillGroupForm createSkillGroup(@Valid @RequestBody SkillGroupForm form) {
        return service.createSkillGroup(form);
    }

    @PutMapping("/skill-groups/{id}")
    SkillGroupForm updateSkillGroup(@PathVariable long id, @Valid @RequestBody SkillGroupForm form) {
        return service.updateSkillGroup(id, form);
    }

    @DeleteMapping("/skill-groups/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteSkillGroup(@PathVariable long id) {
        service.deleteSkillGroup(id);
    }

    @GetMapping("/credentials")
    List<CredentialForm> credentials() {
        return service.credentials();
    }

    @PostMapping("/credentials")
    @ResponseStatus(HttpStatus.CREATED)
    CredentialForm createCredential(@Valid @RequestBody CredentialForm form) {
        return service.createCredential(form);
    }

    @PutMapping("/credentials/{id}")
    CredentialForm updateCredential(@PathVariable long id, @Valid @RequestBody CredentialForm form) {
        return service.updateCredential(id, form);
    }

    @DeleteMapping("/credentials/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteCredential(@PathVariable long id) {
        service.deleteCredential(id);
    }

    @GetMapping("/projects")
    List<ProjectForm> projects() {
        return service.projects();
    }

    @PostMapping("/projects")
    @ResponseStatus(HttpStatus.CREATED)
    ProjectForm createProject(@Valid @RequestBody ProjectForm form) {
        return service.createProject(form);
    }

    @PutMapping("/projects/{id}")
    ProjectForm updateProject(@PathVariable long id, @Valid @RequestBody ProjectForm form) {
        return service.updateProject(id, form);
    }

    @DeleteMapping("/projects/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteProject(@PathVariable long id) {
        service.deleteProject(id);
    }
}
