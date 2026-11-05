package org.omnie.portfolioapp.common.ratelimit;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.HexFormat;

/**
 * Turns a remote address into a rate limit key. One IPv6 customer usually controls a whole /64,
 * so IPv6 addresses are limited by that prefix.
 */
public final class ClientKey {

    private static final int IPV6_LENGTH = 16;
    private static final int IPV6_PREFIX_BYTES = 8;

    private ClientKey() {
    }

    public static String of(String remoteAddress) {
        // The address comes from the servlet container and is a literal, so this performs no DNS lookup.
        try {
            byte[] bytes = InetAddress.getByName(remoteAddress).getAddress();
            if (bytes.length == IPV6_LENGTH) {
                return HexFormat.of().formatHex(bytes, 0, IPV6_PREFIX_BYTES) + "/64";
            }
            return remoteAddress;
        } catch (UnknownHostException e) {
            return remoteAddress;
        }
    }
}
