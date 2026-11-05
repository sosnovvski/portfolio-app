package org.omnie.portfolioapp.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

interface ExperienceRepository extends JpaRepository<Experience, Long> {

    List<Experience> findByPublishedTrueOrderByStartMonthDescIdDesc();

    List<Experience> findAllByOrderByStartMonthDescIdDesc();
}
