package org.omnie.portfolioapp.content;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;

import java.util.ArrayList;
import java.util.List;

@Entity
public class SkillGroup extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nameEn;
    private String namePl;
    private int sortOrder;

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<Skill> skills = new ArrayList<>();

    void apply(AdminContent.SkillGroupForm form) {
        nameEn = form.nameEn();
        namePl = form.namePl();
        sortOrder = form.sortOrder();
        skills.clear();
        for (String skill : form.skills()) {
            skills.add(new Skill(this, skill, skills.size()));
        }
        touch();
    }

    AdminContent.SkillGroupForm toForm() {
        return new AdminContent.SkillGroupForm(id, getVersion(), nameEn, namePl, sortOrder,
                skills.stream().map(Skill::getName).toList());
    }

    public String name(Language language) {
        return language.pick(nameEn, namePl);
    }

    public List<Skill> getSkills() {
        return skills;
    }
}
