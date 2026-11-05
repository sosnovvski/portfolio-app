package org.omnie.portfolioapp.content;

public enum Language {
    EN, PL;

    /** Accepts only the path values allowed by the public controller. */
    public static Language fromPath(String value) {
        return switch (value) {
            case "en" -> EN;
            case "pl" -> PL;
            default -> throw new IllegalArgumentException("Unsupported locale: " + value);
        };
    }

    public String pick(String en, String pl) {
        return this == EN ? en : pl;
    }
}
