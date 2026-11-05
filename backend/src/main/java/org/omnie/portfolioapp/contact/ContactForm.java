package org.omnie.portfolioapp.contact;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * @param contactRef honeypot: hidden from people, so any value marks the sender as a bot. The name is
 *                   deliberately meaningless, so browsers and password managers do not fill it in and lose a real message.
 */
public record ContactForm(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Size(max = 254) @Email
        @Pattern(regexp = "^[^@\\s]+@[^@\\s]+$", message = "must be a valid email address") String email,
        @NotBlank @Size(min = 10, max = 5000) String message,
        @NotNull @Pattern(regexp = "en|pl") String locale,
        String contactRef) {
}
