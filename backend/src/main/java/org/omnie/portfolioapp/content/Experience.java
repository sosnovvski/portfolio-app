package org.omnie.portfolioapp.content;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;

import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

@Entity
public class Experience extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String employer;
    private String client;
    private String roleEn;
    private String rolePl;
    private String locationEn;
    private String locationPl;

    @Convert(converter = YearMonthConverter.class)
    private YearMonth startMonth;

    @Convert(converter = YearMonthConverter.class)
    private YearMonth endMonth;

    private boolean published;

    @OneToMany(mappedBy = "experience", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<Achievement> achievements = new ArrayList<>();

    void apply(AdminContent.ExperienceForm form) {
        employer = form.employer();
        client = form.client();
        roleEn = form.roleEn();
        rolePl = form.rolePl();
        locationEn = form.locationEn();
        locationPl = form.locationPl();
        startMonth = YearMonth.parse(form.start());
        endMonth = form.end() == null ? null : YearMonth.parse(form.end());
        published = form.published();
        achievements.clear();
        for (AdminContent.AchievementForm item : form.achievements()) {
            achievements.add(new Achievement(this, item.textEn(), item.textPl(), achievements.size()));
        }
        touch();
    }

    AdminContent.ExperienceForm toForm() {
        return new AdminContent.ExperienceForm(id, getVersion(), employer, client, roleEn, rolePl,
                locationEn, locationPl, startMonth.toString(), endMonth == null ? null : endMonth.toString(), published,
                achievements.stream().map(Achievement::toForm).toList());
    }

    public Long getId() {
        return id;
    }

    public String getEmployer() {
        return employer;
    }

    public String getClient() {
        return client;
    }

    public String role(Language language) {
        return language.pick(roleEn, rolePl);
    }

    public String location(Language language) {
        return language.pick(locationEn, locationPl);
    }

    public YearMonth getStartMonth() {
        return startMonth;
    }

    public YearMonth getEndMonth() {
        return endMonth;
    }

    public List<Achievement> getAchievements() {
        return achievements;
    }
}
