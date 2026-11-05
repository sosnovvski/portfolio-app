package org.omnie.portfolioapp.content;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.YearMonth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class YearMonthConverterTest {

    private final YearMonthConverter converter = new YearMonthConverter();

    @Test
    void storesFirstDayOfMonth() {
        assertEquals(LocalDate.of(2021, 4, 1), converter.convertToDatabaseColumn(YearMonth.of(2021, 4)));
    }

    @Test
    void readsMonthFromDate() {
        assertEquals(YearMonth.of(2021, 4), converter.convertToEntityAttribute(LocalDate.of(2021, 4, 1)));
    }

    @Test
    void keepsNullForCurrentRole() {
        assertNull(converter.convertToDatabaseColumn(null));
        assertNull(converter.convertToEntityAttribute(null));
    }
}
