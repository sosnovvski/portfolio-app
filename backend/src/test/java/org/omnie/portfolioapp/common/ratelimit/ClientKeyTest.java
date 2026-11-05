package org.omnie.portfolioapp.common.ratelimit;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

class ClientKeyTest {

    @Test
    void ipv4IsKeptWhole() {
        assertEquals("203.0.113.7", ClientKey.of("203.0.113.7"));
        assertNotEquals(ClientKey.of("203.0.113.7"), ClientKey.of("203.0.113.8"));
    }

    @Test
    void ipv6SharesKeyWithinOneSlash64() {
        assertEquals(ClientKey.of("2001:db8:1:2::1"), ClientKey.of("2001:db8:1:2:ffff:ffff:ffff:ffff"));
    }

    @Test
    void differentIpv6PrefixesGetDifferentKeys() {
        assertNotEquals(ClientKey.of("2001:db8:1:2::1"), ClientKey.of("2001:db8:1:3::1"));
    }
}
