package org.omnie.portfolioapp.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByPublishedTrueOrderBySortOrderAscIdAsc();

    List<Project> findAllByOrderBySortOrderAscIdAsc();
}
