package org.omnie.portfolioapp.content;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

@Entity
public class Credential extends AuditedEntity {

    public enum Kind { CERTIFICATION, EDUCATION }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    private Kind kind;

    private String titleEn;
    private String titlePl;
    private String issuer;
    private Integer startYear;
    private Integer endYear;
    private String url;
    private int sortOrder;

    void apply(AdminContent.CredentialForm form) {
        kind = form.kind();
        titleEn = form.titleEn();
        titlePl = form.titlePl();
        issuer = form.issuer();
        startYear = form.startYear();
        endYear = form.endYear();
        url = form.url();
        sortOrder = form.sortOrder();
        touch();
    }

    AdminContent.CredentialForm toForm() {
        return new AdminContent.CredentialForm(id, getVersion(), kind, titleEn, titlePl, issuer,
                startYear, endYear, url, sortOrder);
    }

    public Kind getKind() {
        return kind;
    }

    public String title(Language language) {
        return language.pick(titleEn, titlePl);
    }

    public String getIssuer() {
        return issuer;
    }

    public Integer getStartYear() {
        return startYear;
    }

    public Integer getEndYear() {
        return endYear;
    }

    public String getUrl() {
        return url;
    }
}
