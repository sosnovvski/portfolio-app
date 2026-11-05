package org.omnie.portfolioapp.content;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity
public class Achievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "experience_id")
    private Experience experience;

    private String textEn;
    private String textPl;
    private int sortOrder;

    protected Achievement() {
    }

    Achievement(Experience experience, String textEn, String textPl, int sortOrder) {
        this.experience = experience;
        this.textEn = textEn;
        this.textPl = textPl;
        this.sortOrder = sortOrder;
    }

    AdminContent.AchievementForm toForm() {
        return new AdminContent.AchievementForm(textEn, textPl);
    }

    public String text(Language language) {
        return language.pick(textEn, textPl);
    }
}
