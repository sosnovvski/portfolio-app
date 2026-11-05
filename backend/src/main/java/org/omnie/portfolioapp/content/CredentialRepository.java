package org.omnie.portfolioapp.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

interface CredentialRepository extends JpaRepository<Credential, Long> {

    List<Credential> findAllByOrderBySortOrderAscIdAsc();
}
