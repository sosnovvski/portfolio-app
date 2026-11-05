package org.omnie.portfolioapp.contact;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;

interface ContactMessageRepository extends JpaRepository<ContactMessage, Long> {

    Page<ContactMessage> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);

    @Modifying
    @Query("delete from ContactMessage m where m.createdAt < :cutoff")
    int deleteCreatedBefore(Instant cutoff);
}
