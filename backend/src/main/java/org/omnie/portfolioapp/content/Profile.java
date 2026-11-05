package org.omnie.portfolioapp.content;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

@Entity
public class Profile extends AuditedEntity {

    public static final int SINGLE_ROW_ID = 1;

    @Id
    private Integer id = SINGLE_ROW_ID;

    private String fullName;
    private String headlineEn;
    private String headlinePl;
    private String summaryEn;
    private String summaryPl;
    private String locationEn;
    private String locationPl;
    private String linkedinUrl;
    private String githubUrl;
    private String publicEmail;

    void apply(AdminContent.ProfileForm form) {
        fullName = form.fullName();
        headlineEn = form.headlineEn();
        headlinePl = form.headlinePl();
        summaryEn = form.summaryEn();
        summaryPl = form.summaryPl();
        locationEn = form.locationEn();
        locationPl = form.locationPl();
        linkedinUrl = form.linkedinUrl();
        githubUrl = form.githubUrl();
        publicEmail = form.publicEmail();
        touch();
    }

    AdminContent.ProfileForm toForm() {
        return new AdminContent.ProfileForm(getVersion(), fullName, headlineEn, headlinePl, summaryEn, summaryPl,
                locationEn, locationPl, linkedinUrl, githubUrl, publicEmail);
    }

    public String getFullName() {
        return fullName;
    }

    public String headline(Language language) {
        return language.pick(headlineEn, headlinePl);
    }

    public String summary(Language language) {
        return language.pick(summaryEn, summaryPl);
    }

    public String location(Language language) {
        return language.pick(locationEn, locationPl);
    }

    public String getLinkedinUrl() {
        return linkedinUrl;
    }

    public String getGithubUrl() {
        return githubUrl;
    }

    public String getPublicEmail() {
        return publicEmail;
    }
}
