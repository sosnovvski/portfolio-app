package org.omnie.portfolioapp.contact;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.time.Instant;

/** A visitor's message. The sender's IP address is deliberately not stored. */
@Entity
public class ContactMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String email;
    private String message;
    private String locale;

    @Column(updatable = false)
    private Instant createdAt;

    private Instant readAt;

    protected ContactMessage() {
    }

    ContactMessage(String name, String email, String message, String locale, Instant createdAt) {
        this.name = name;
        this.email = email;
        this.message = message;
        this.locale = locale;
        this.createdAt = createdAt;
    }

    void setRead(boolean read, Instant now) {
        readAt = read ? (readAt == null ? now : readAt) : null;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getMessage() {
        return message;
    }

    public String getLocale() {
        return locale;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getReadAt() {
        return readAt;
    }
}
