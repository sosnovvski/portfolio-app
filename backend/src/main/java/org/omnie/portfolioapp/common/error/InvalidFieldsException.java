package org.omnie.portfolioapp.common.error;

import java.util.List;

/** Validation that has to run later than Spring's {@code @Valid} step. */
public class InvalidFieldsException extends RuntimeException {

    private final transient List<FieldError> errors;

    public InvalidFieldsException(List<FieldError> errors) {
        super("Some fields are not valid.");
        this.errors = errors;
    }

    public List<FieldError> getErrors() {
        return errors;
    }
}
