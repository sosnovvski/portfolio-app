package org.omnie.portfolioapp.content;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Version;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@MappedSuperclass
public abstract class AuditedEntity {

    @Version
    private Long version;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @CreationTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public Long getVersion() {
        return version;
    }

    /**
     * Marks the entity as edited even when only its child rows changed. The dirty timestamp makes
     * Hibernate raise the version on flush, so a stale editor always gets a conflict.
     */
    protected void touch() {
        updatedAt = Instant.now();
    }
}
