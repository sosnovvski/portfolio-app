package org.omnie.portfolioapp.contact;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.omnie.portfolioapp.common.error.FieldError;
import org.omnie.portfolioapp.common.error.InvalidFieldsException;
import org.omnie.portfolioapp.common.error.NotFoundException;
import org.omnie.portfolioapp.common.error.RateLimitedException;
import org.omnie.portfolioapp.common.ratelimit.ClientKey;
import org.omnie.portfolioapp.common.ratelimit.FixedWindowRateLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Set;

@Service
public class ContactService {

    private static final Logger log = LoggerFactory.getLogger(ContactService.class);
    private static final String GLOBAL_KEY = "global";

    private final ContactMessageRepository messages;
    private final Validator validator;
    private final Clock clock;
    private final FixedWindowRateLimiter perClient;
    private final FixedWindowRateLimiter global;

    @Autowired
    ContactService(ContactMessageRepository messages, Validator validator, Clock clock) {
        this(messages, validator, clock,
                new FixedWindowRateLimiter(5, Duration.ofHours(1), clock),
                new FixedWindowRateLimiter(50, Duration.ofDays(1), clock));
    }

    ContactService(ContactMessageRepository messages, Validator validator, Clock clock,
                   FixedWindowRateLimiter perClient, FixedWindowRateLimiter global) {
        this.messages = messages;
        this.validator = validator;
        this.clock = clock;
        this.perClient = perClient;
        this.global = global;
    }

    /**
     * The order matters. Bots hit the per-client limit like anyone else, a filled honeypot looks like success
     * and costs no global quota, and only valid messages can use up the global quota.
     */
    @Transactional
    public void submit(ContactForm form, String remoteAddress) {
        FixedWindowRateLimiter.Decision clientDecision = perClient.tryAcquire(ClientKey.of(remoteAddress));
        if (!clientDecision.allowed()) {
            throw new RateLimitedException(clientDecision.retryAfter(),
                    "Too many messages from your network. Try again later.");
        }

        if (form.contactRef() != null && !form.contactRef().isEmpty()) {
            return;
        }

        Set<ConstraintViolation<ContactForm>> violations = validator.validate(form);
        if (!violations.isEmpty()) {
            throw new InvalidFieldsException(violations.stream()
                    .map(violation -> new FieldError(violation.getPropertyPath().toString(), violation.getMessage()))
                    .toList());
        }

        FixedWindowRateLimiter.Decision globalDecision = global.tryAcquire(GLOBAL_KEY);
        if (!globalDecision.allowed()) {
            // Without this warning the form could stay closed for a day without anyone noticing.
            log.warn("Daily contact message quota is used up. The form stays closed for {}.", globalDecision.retryAfter());
            throw new RateLimitedException(globalDecision.retryAfter(),
                    "The contact form is temporarily closed. Try again later or use LinkedIn.");
        }

        messages.save(new ContactMessage(form.name(), form.email(), form.message(), form.locale(), clock.instant()));
    }

    @Transactional(readOnly = true)
    public MessagePage list(int page, int size) {
        Page<ContactMessage> result = messages.findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(page, size));
        List<MessageView> items = result.getContent().stream().map(MessageView::from).toList();
        return new MessagePage(items, result.getTotalElements(), page, size);
    }

    @Transactional
    public MessageView setRead(long id, boolean read) {
        ContactMessage message = find(id);
        message.setRead(read, clock.instant());
        return MessageView.from(message);
    }

    @Transactional
    public void delete(long id) {
        messages.delete(find(id));
    }

    private ContactMessage find(long id) {
        return messages.findById(id).orElseThrow(() -> new NotFoundException("This message no longer exists."));
    }
}
