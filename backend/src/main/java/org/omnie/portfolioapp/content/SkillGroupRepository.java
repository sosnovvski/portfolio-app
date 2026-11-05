package org.omnie.portfolioapp.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

interface SkillGroupRepository extends JpaRepository<SkillGroup, Long> {

    List<SkillGroup> findAllByOrderBySortOrderAscIdAsc();
}
