package org.omnie.portfolioapp.contact;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record MessagePage(
        @NotNull List<MessageView> items,
        @NotNull Long total,
        @NotNull Integer page,
        @NotNull Integer size) {
}
