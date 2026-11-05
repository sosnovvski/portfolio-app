package org.omnie.portfolioapp.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.regex.Pattern;

/**
 * The single admin account. Checked by {@link #requireValid()} rather than Bean Validation, because Boot
 * prints rejected values at startup, which would put a mistakenly pasted password into the logs.
 */
@ConfigurationProperties("app.admin")
public record AdminProperties(String username, String passwordHash) {

    private static final Pattern BCRYPT = Pattern.compile("\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}");

    AdminProperties requireValid() {
        if (username == null || username.isBlank()) {
            throw new IllegalStateException("Set ADMIN_USERNAME.");
        }
        if (passwordHash == null || !BCRYPT.matcher(passwordHash).matches()) {
            throw new IllegalStateException("Set ADMIN_PASSWORD_HASH to a bcrypt hash.");
        }
        return this;
    }

    @Override
    public String toString() {
        return "AdminProperties[username=" + username + "]";
    }
}
