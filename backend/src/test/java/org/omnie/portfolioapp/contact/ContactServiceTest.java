package org.omnie.portfolioapp.contact;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.omnie.portfolioapp.common.error.FieldError;
import org.omnie.portfolioapp.common.error.InvalidFieldsException;
import org.omnie.portfolioapp.common.error.RateLimitedException;
import org.omnie.portfolioapp.common.ratelimit.FixedWindowRateLimiter;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ContactServiceTest {

    private static final String ADDRESS = "203.0.113.1";
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    @Mock
    private ContactMessageRepository messages;

    private ContactService service;

    @BeforeEach
    void setUp() {
        service = new ContactService(messages, VALIDATOR, CLOCK,
                new FixedWindowRateLimiter(3, Duration.ofHours(1), CLOCK),
                new FixedWindowRateLimiter(2, Duration.ofDays(1), CLOCK));
    }

    private static ContactForm valid() {
        return new ContactForm("Visitor", "visitor@example.test", "A message long enough.", "en", null);
    }

    private static ContactForm bot() {
        return new ContactForm("Bot", "bot@example.test", "Buy things right now.", "en", "https://spam.test");
    }

    @Test
    void validMessageIsStored() {
        service.submit(valid(), ADDRESS);

        verify(messages).save(any(ContactMessage.class));
    }

    @Test
    void honeypotLooksLikeSuccessAndStoresNothing() {
        assertDoesNotThrow(() -> service.submit(bot(), ADDRESS));

        verify(messages, never()).save(any());
    }

    @Test
    void honeypotWinsOverInvalidFieldsSoBotsCannotTellThePathsApart() {
        ContactForm invalidBot = new ContactForm(null, "nope", "short", "de", "filled");

        assertDoesNotThrow(() -> service.submit(invalidBot, ADDRESS));
    }

    @Test
    void invalidFieldsAreListedAndNothingIsStored() {
        ContactForm form = new ContactForm(" ", "not-an-email", "short", "de", "");

        InvalidFieldsException exception = assertThrows(InvalidFieldsException.class,
                () -> service.submit(form, ADDRESS));

        List<String> fields = exception.getErrors().stream().map(FieldError::field).toList();
        assertTrue(fields.containsAll(List.of("name", "email", "message", "locale")), fields.toString());
        verify(messages, never()).save(any());
    }

    @Test
    void perClientLimitAppliesToBotsToo() {
        service.submit(bot(), ADDRESS);
        service.submit(bot(), ADDRESS);
        service.submit(bot(), ADDRESS);

        RateLimitedException exception = assertThrows(RateLimitedException.class,
                () -> service.submit(bot(), ADDRESS));

        assertEquals(Duration.ofHours(1), exception.getRetryAfter());
    }

    @Test
    void botsCannotUseUpTheGlobalQuota() {
        for (int i = 1; i <= 10; i++) {
            service.submit(bot(), "203.0.113." + i);
        }

        service.submit(valid(), ADDRESS);
        service.submit(valid(), "198.51.100.1");

        verify(messages, times(2)).save(any());
    }

    @Test
    void invalidMessagesDoNotUseUpTheGlobalQuota() {
        ContactForm invalid = new ContactForm("Visitor", "nope", "short", "en", null);
        for (int i = 1; i <= 10; i++) {
            String address = "203.0.113." + i;
            assertThrows(InvalidFieldsException.class, () -> service.submit(invalid, address));
        }

        assertDoesNotThrow(() -> service.submit(valid(), ADDRESS));
    }

    @Test
    void globalLimitStopsMessagesFromManyAddresses() {
        service.submit(valid(), "198.51.100.1");
        service.submit(valid(), "198.51.100.2");

        assertThrows(RateLimitedException.class, () -> service.submit(valid(), "198.51.100.3"));

        verify(messages, times(2)).save(any());
    }

    @Test
    void ipv6AddressesInOneNetworkShareALimit() {
        service.submit(bot(), "2001:db8:1:2::1");
        service.submit(bot(), "2001:db8:1:2::2");
        service.submit(bot(), "2001:db8:1:2::3");

        assertThrows(RateLimitedException.class, () -> service.submit(bot(), "2001:db8:1:2::4"));
    }
}
