package org.omnie.portfolioapp.contact;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record MessageView(
        @NotNull Long id,
        @NotNull String name,
        @NotNull String email,
        @NotNull String message,
        @NotNull String locale,
        @NotNull Instant createdAt,
        Instant readAt) {

    static MessageView from(ContactMessage message) {
        return new MessageView(message.getId(), message.getName(), message.getEmail(), message.getMessage(),
                message.getLocale(), message.getCreatedAt(), message.getReadAt());
    }
}
