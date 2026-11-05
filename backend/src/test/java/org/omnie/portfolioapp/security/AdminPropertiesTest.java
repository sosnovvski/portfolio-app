package org.omnie.portfolioapp.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AdminPropertiesTest {

    private static final String HASH = "$2b$04$QcKCBf76k01GzrdKIOwc.uOUcrr67ngx7dMcBLu4IJ1Ju4zBfVUcq";

    @ParameterizedTest
    @ValueSource(strings = {"$2a", "$2b", "$2y"})
    void acceptsBcryptPrefixes(String prefix) {
        assertDoesNotThrow(() -> new AdminProperties("admin", prefix + HASH.substring(3)).requireValid());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "hunter2", "$1$04$QcKCBf76k01GzrdKIOwc.uOUcrr67ngx7dMcBLu4IJ1Ju4zBfVUcq"})
    void refusesAnythingButBcryptAndNeverEchoesTheValue(String value) {
        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> new AdminProperties("admin", value).requireValid());

        if (!value.isEmpty()) {
            assertFalse(exception.getMessage().contains(value));
        }
    }

    @Test
    void refusesMissingValues() {
        assertThrows(IllegalStateException.class, () -> new AdminProperties("admin", null).requireValid());
        assertThrows(IllegalStateException.class, () -> new AdminProperties(" ", HASH).requireValid());
        assertThrows(IllegalStateException.class, () -> new AdminProperties(null, HASH).requireValid());
    }

    @Test
    void toStringNeverContainsTheHash() {
        assertFalse(new AdminProperties("admin", HASH).toString().contains(HASH));
    }
}
