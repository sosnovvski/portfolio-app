package org.omnie.portfolioapp.common.error;

import jakarta.validation.constraints.NotNull;

public record FieldError(@NotNull String field, @NotNull String message) {
}
