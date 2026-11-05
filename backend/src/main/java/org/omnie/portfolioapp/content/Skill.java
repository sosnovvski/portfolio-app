package org.omnie.portfolioapp.content;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity
public class Skill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id")
    private SkillGroup group;

    private String name;
    private int sortOrder;

    protected Skill() {
    }

    Skill(SkillGroup group, String name, int sortOrder) {
        this.group = group;
        this.name = name;
        this.sortOrder = sortOrder;
    }

    public String getName() {
        return name;
    }
}
