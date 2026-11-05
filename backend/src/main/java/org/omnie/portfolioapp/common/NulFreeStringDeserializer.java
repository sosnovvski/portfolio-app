package org.omnie.portfolioapp.common;

import org.springframework.boot.jackson.JacksonComponent;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;
import tools.jackson.databind.deser.jdk.StringDeserializer;

/**
 * PostgreSQL cannot store NUL characters and a request containing one would end in a server error,
 * so they are removed from every incoming string before validation.
 */
@JacksonComponent(type = String.class)
class NulFreeStringDeserializer extends ValueDeserializer<String> {

    private static final StringDeserializer DEFAULT = new StringDeserializer();

    @Override
    public String deserialize(JsonParser parser, DeserializationContext context) {
        String value = DEFAULT.deserialize(parser, context);
        return value == null ? null : value.replace("\u0000", "");
    }
}
