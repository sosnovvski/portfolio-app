package org.omnie.portfolioapp.content;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;

@Entity
public class Project extends AuditedEntity {

    public enum Status { PLANNED, IN_DEVELOPMENT, LIVE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String slug;
    private String nameEn;
    private String namePl;
    private String summaryEn;
    private String summaryPl;

    @Enumerated(EnumType.STRING)
    private Status status;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private String[] tech = new String[0];

    private String repoUrl;
    private String liveUrl;
    private int sortOrder;
    private boolean published;

    void apply(AdminContent.ProjectForm form) {
        slug = form.slug();
        nameEn = form.nameEn();
        namePl = form.namePl();
        summaryEn = form.summaryEn();
        summaryPl = form.summaryPl();
        status = form.status();
        tech = form.tech().toArray(String[]::new);
        repoUrl = form.repoUrl();
        liveUrl = form.liveUrl();
        sortOrder = form.sortOrder();
        published = form.published();
        touch();
    }

    AdminContent.ProjectForm toForm() {
        return new AdminContent.ProjectForm(id, getVersion(), slug, nameEn, namePl, summaryEn, summaryPl, status,
                List.of(tech), repoUrl, liveUrl, sortOrder, published);
    }

    public String getSlug() {
        return slug;
    }

    public String name(Language language) {
        return language.pick(nameEn, namePl);
    }

    public String summary(Language language) {
        return language.pick(summaryEn, summaryPl);
    }

    public Status getStatus() {
        return status;
    }

    public List<String> getTech() {
        return List.of(tech);
    }

    public String getRepoUrl() {
        return repoUrl;
    }

    public String getLiveUrl() {
        return liveUrl;
    }
}
