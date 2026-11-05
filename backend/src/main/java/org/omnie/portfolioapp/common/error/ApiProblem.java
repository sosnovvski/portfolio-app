package org.omnie.portfolioapp.common.error;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/** Documents the shape of every error response for the API contract. Handlers write it as RFC 9457. */
public record ApiProblem(
        String type,
        @NotNull String title,
        @NotNull Integer status,
        String detail,
        String instance,
        List<FieldError> errors) {
}
