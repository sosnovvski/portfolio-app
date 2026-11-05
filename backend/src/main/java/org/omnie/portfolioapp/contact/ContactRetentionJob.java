package org.omnie.portfolioapp.contact;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.ZoneOffset;

/** Deletes messages after the retention period stated in the privacy notice. */
@Component
class ContactRetentionJob {

    private static final Logger log = LoggerFactory.getLogger(ContactRetentionJob.class);
    private static final int RETENTION_MONTHS = 12;

    private final ContactMessageRepository messages;
    private final Clock clock;

    ContactRetentionJob(ContactMessageRepository messages, Clock clock) {
        this.messages = messages;
        this.clock = clock;
    }

    @Scheduled(cron = "0 30 3 * * *", zone = "UTC")
    @Transactional
    public void deleteExpired() {
        var cutoff = clock.instant().atOffset(ZoneOffset.UTC).minusMonths(RETENTION_MONTHS).toInstant();
        int deleted = messages.deleteCreatedBefore(cutoff);
        if (deleted > 0) {
            log.info("Deleted {} contact messages past the retention period.", deleted);
        }
    }
}
