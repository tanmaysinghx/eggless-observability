package com.tanmaysinghx.eggless_server.connect;

import com.tanmaysinghx.eggless_server.config.PortalSsoProperties;
import com.tanmaysinghx.eggless_server.service.PortalSsoClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Eggless's half of "Connect with Portal SSO".
 *
 * <ol>
 *   <li>{@link #start}: the operator (holding the setup token) names a Portal. Eggless checks it is
 *       an OIDC issuer, submits its manifest with an S256 challenge, and returns the approval URL.
 *   <li>A Portal administrator approves; Portal redirects the browser to {@link #complete} with a
 *       one-time code.
 *   <li>Eggless redeems code + verifier server-to-server and stores the credentials encrypted.
 * </ol>
 *
 * <p>The credentials never touch the browser. Environment variables still win: if
 * {@code PORTAL_CLIENT_SECRET} or {@code PORTAL_API_KEY} is set, the instance is "managed by
 * environment" and this flow is disabled, so a deployment's configuration cannot be silently
 * overridden from the UI.
 */
@Slf4j
@Service
public class PortalConnectService implements SmartInitializingSingleton {

    public static final String CALLBACK_PATH = "/api/portal-connect/callback";
    private static final String PRODUCT_ID = "eggless-observability";
    private static final Set<String> LOOPBACK = Set.of("localhost", "127.0.0.1", "[::1]");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final PortalSsoProperties properties;
    private final PortalSsoClient portalSsoClient;
    private final PortalConnectionRepository connections;
    private final PortalConnectAttemptRepository attempts;
    private final SecretBox secretBox;
    private final SetupTokenService setupTokens;
    private final String configuredPublicUrl;
    private final RestClient http = RestClient.create();

    private final boolean environmentManaged;
    private final PortalSsoProperties environmentSnapshot = new PortalSsoProperties();

    public PortalConnectService(
            PortalSsoProperties properties,
            PortalSsoClient portalSsoClient,
            PortalConnectionRepository connections,
            PortalConnectAttemptRepository attempts,
            SecretBox secretBox,
            SetupTokenService setupTokens,
            @Value("${eggless.public-url:}") String configuredPublicUrl) {
        this.properties = properties;
        this.portalSsoClient = portalSsoClient;
        this.connections = connections;
        this.attempts = attempts;
        this.secretBox = secretBox;
        this.setupTokens = setupTokens;
        this.configuredPublicUrl = stripSlash(configuredPublicUrl);
        this.environmentManaged = isSet(properties.getClientSecret()) || isSet(properties.getAppKey());
        copy(properties, environmentSnapshot);
    }

    /** Applies a stored connection before the web server takes requests. */
    @Override
    public void afterSingletonsInstantiated() {
        if (environmentManaged) {
            log.info("Portal SSO is configured by environment variables; 'Connect with Portal SSO' is disabled.");
            return;
        }
        var connection = connections.findById(PortalConnectionEntity.SINGLETON_ID);
        connection.ifPresent(this::apply);
        setupTokens.announce(connection.isPresent());
    }

    // ------------------------------------------------------------------ status

    public record Status(
            String mode,
            String portalUrl,
            String clientId,
            String applicationId,
            Instant connectedAt,
            String pendingApprovalUrl,
            String setupTokenFile) {}

    @Transactional(readOnly = true)
    public Status status() {
        String tokenFile = setupTokens.tokenFile().toString();
        if (environmentManaged) {
            return new Status("environment", properties.getNormalizedBaseUrl(), properties.getClientId(),
                    properties.getApplicationId(), null, null, tokenFile);
        }
        var connection = connections.findById(PortalConnectionEntity.SINGLETON_ID);
        if (connection.isPresent()) {
            PortalConnectionEntity c = connection.get();
            return new Status("connected", c.getPortalUrl(), c.getClientId(), c.getApplicationId(), c.getConnectedAt(), null, tokenFile);
        }
        var pending = attempts.findFirstByOrderByCreatedAtDesc()
                .filter(a -> a.getExpiresAt() == null || a.getExpiresAt().isAfter(Instant.now()));
        return pending
                .map(a -> new Status("pending", a.getPortalUrl(), null, null, null, a.getApprovalUrl(), tokenFile))
                .orElseGet(() -> new Status("not_connected", null, null, null, null, null, tokenFile));
    }

    // ------------------------------------------------------------------ start

    /** @return the Portal approval URL to send the operator's browser to */
    @Transactional
    @SuppressWarnings("unchecked")
    public String start(String portalUrlInput, String browserOrigin, String setupToken) {
        requireToken(setupToken);
        if (environmentManaged) {
            throw new ConnectException(409, "Portal SSO is configured by environment variables. Remove PORTAL_CLIENT_SECRET and PORTAL_API_KEY to use Connect.");
        }

        String portalUrl = requireHttpUrl(portalUrlInput, "Portal URL");
        String publicUrl = requireHttpUrl(isSet(configuredPublicUrl) ? configuredPublicUrl : browserOrigin, "Eggless address");

        // Must be a real OIDC issuer at exactly this address: catches typos and stops a request being
        // sent to something that merely answers HTTP.
        Map<String, Object> discovery;
        try {
            discovery = http.get().uri(portalUrl + "/.well-known/openid-configuration").retrieve().body(Map.class);
        } catch (Exception e) {
            throw new ConnectException(502, "Could not reach Portal SSO at " + portalUrl + ": " + e.getMessage());
        }
        if (discovery == null || !portalUrl.equals(stripSlash(String.valueOf(discovery.get("issuer"))))) {
            throw new ConnectException(400, "That address is not a Portal SSO issuer (its discovery document names a different issuer). "
                    + "Use the exact public URL of your Portal.");
        }

        String verifier = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes(32));
        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("product", PRODUCT_ID);
        manifest.put("name", "Eggless Observability");
        manifest.put("description", "Logs, live tail and alerts");
        manifest.put("appUrl", publicUrl);
        manifest.put("iconUrl", publicUrl + "/eggless-logo.png");
        manifest.put("clientId", PRODUCT_ID);
        manifest.put("redirectUris", List.of(publicUrl + "/auth/callback"));
        manifest.put("scopes", List.of("openid", "profile", "email"));
        manifest.put("confidential", true);
        // The login screen offers email/password and registration; the Portal admin decides whether to allow them.
        manifest.put("externalAuth", true);
        manifest.put("externalRegistration", true);

        Map<String, Object> created;
        try {
            created = http.post()
                    .uri(portalUrl + "/api/external/connect/requests")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "manifest", manifest,
                            "callbackUri", publicUrl + CALLBACK_PATH,
                            "codeChallenge", s256(verifier),
                            "codeChallengeMethod", "S256"))
                    .retrieve()
                    .body(Map.class);
        } catch (RestClientResponseException e) {
            throw new ConnectException(502, "Portal SSO rejected the connection request: " + portalMessage(e));
        }
        if (created == null || created.get("requestId") == null || created.get("approvalUrl") == null) {
            throw new ConnectException(502, "Portal SSO returned an unexpected response.");
        }

        String approvalUrl = String.valueOf(created.get("approvalUrl"));
        if (!approvalUrl.startsWith(portalUrl + "/")) {
            throw new ConnectException(502, "Portal SSO returned an approval URL on a different address.");
        }

        attempts.deleteAll();
        PortalConnectAttemptEntity attempt = new PortalConnectAttemptEntity();
        attempt.setRequestId(String.valueOf(created.get("requestId")));
        attempt.setPortalUrl(portalUrl);
        attempt.setPublicUrl(publicUrl);
        attempt.setVerifierEnc(secretBox.encrypt(verifier));
        attempt.setApprovalUrl(approvalUrl);
        attempt.setCreatedAt(Instant.now());
        if (created.get("expiresAt") != null) {
            attempt.setExpiresAt(Instant.parse(String.valueOf(created.get("expiresAt"))));
        }
        attempts.save(attempt);
        log.info("Submitted Portal SSO connection request {} to {}", attempt.getRequestId(), portalUrl);
        return approvalUrl;
    }

    // ------------------------------------------------------------------ complete (callback)

    /**
     * Handles Portal's redirect. Only requests this backend submitted (and still holds a verifier
     * for) are redeemed, so a crafted callback link cannot connect Eggless to someone else's Portal.
     */
    // noRollbackFor: a denial deletes the attempt and then reports it; every other ConnectException
    // is thrown before anything is written.
    @Transactional(noRollbackFor = ConnectException.class)
    @SuppressWarnings("unchecked")
    public void complete(String requestId, String code, String error) {
        PortalConnectAttemptEntity attempt = requestId == null ? null : attempts.findById(requestId).orElse(null);
        if (attempt == null) {
            throw new ConnectException(400, "This connection link is not one Eggless started, or it was already used.");
        }
        if (error != null) {
            attempts.delete(attempt);
            throw new ConnectException(403, "A Portal administrator denied the connection.");
        }
        if (code == null || code.isBlank()) {
            throw new ConnectException(400, "Portal did not include a connection code.");
        }

        Map<String, Object> redeemed;
        try {
            redeemed = http.post()
                    .uri(attempt.getPortalUrl() + "/api/external/connect/requests/" + attempt.getRequestId() + "/redeem")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("code", code, "codeVerifier", secretBox.decrypt(attempt.getVerifierEnc())))
                    .retrieve()
                    .body(Map.class);
        } catch (RestClientResponseException e) {
            throw new ConnectException(502, "Portal SSO did not hand over the credentials: " + portalMessage(e));
        }

        Map<String, Object> credentials = map(redeemed, "credentials");
        Map<String, Object> oidc = map(credentials, "oidc");
        Map<String, Object> externalAuth = map(credentials, "externalAuth");
        if (oidc == null || oidc.get("clientId") == null) {
            throw new ConnectException(502, "Portal SSO returned no OAuth client.");
        }
        if (!attempt.getPortalUrl().equals(stripSlash(String.valueOf(credentials.get("issuerUrl"))))) {
            throw new ConnectException(502, "Portal SSO reported a different issuer than the one Eggless connected to.");
        }

        PortalConnectionEntity connection = connections.findById(PortalConnectionEntity.SINGLETON_ID).orElseGet(PortalConnectionEntity::new);
        connection.setPortalUrl(attempt.getPortalUrl());
        connection.setPublicUrl(attempt.getPublicUrl());
        connection.setApplicationId(String.valueOf(redeemed.get("applicationId")));
        connection.setClientId(String.valueOf(oidc.get("clientId")));
        connection.setClientSecretEnc(secretBox.encrypt((String) oidc.get("clientSecret")));
        connection.setRedirectUri(attempt.getPublicUrl() + "/auth/callback");
        Object scopes = oidc.get("scopes");
        connection.setScopes(scopes instanceof List<?> list ? String.join(" ", (List<String>) list) : "openid profile email");
        connection.setApiKeyEnc(externalAuth == null ? null : secretBox.encrypt((String) externalAuth.get("apiKey")));
        connection.setLoginEndpoint(externalAuth == null ? null : (String) externalAuth.get("loginEndpoint"));
        connection.setRegisterEndpoint(externalAuth == null ? null : (String) externalAuth.get("registerEndpoint"));
        connection.setConnectedAt(Instant.now());
        connections.save(connection);
        attempts.deleteAll();

        apply(connection);
        log.info("Connected to Portal SSO at {} as client {}", connection.getPortalUrl(), connection.getClientId());
    }

    // ------------------------------------------------------------------ disconnect

    /** Forgets the stored credentials. The application stays registered in Portal until an admin removes it. */
    @Transactional
    public void disconnect(String setupToken) {
        requireToken(setupToken);
        if (environmentManaged) {
            throw new ConnectException(409, "Portal SSO is configured by environment variables.");
        }
        connections.deleteAll();
        attempts.deleteAll();
        copy(environmentSnapshot, properties);
        portalSsoClient.resetVerifier();
        log.info("Disconnected from Portal SSO");
    }

    // ------------------------------------------------------------------ helpers

    private void apply(PortalConnectionEntity c) {
        properties.setBaseUrl(c.getPortalUrl());
        properties.setApplicationId(c.getApplicationId());
        properties.setClientId(c.getClientId());
        properties.setClientSecret(nullToEmpty(secretBox.decrypt(c.getClientSecretEnc())));
        properties.setAppKey(nullToEmpty(secretBox.decrypt(c.getApiKeyEnc())));
        properties.setRedirectUri(c.getRedirectUri());
        properties.setScopes(c.getScopes());
        properties.setLoginEndpoint(nullToEmpty(c.getLoginEndpoint()));
        properties.setRegisterEndpoint(nullToEmpty(c.getRegisterEndpoint()));
        portalSsoClient.resetVerifier();
    }

    private static void copy(PortalSsoProperties from, PortalSsoProperties to) {
        to.setBaseUrl(from.getBaseUrl());
        to.setApplicationId(from.getApplicationId());
        to.setClientId(from.getClientId());
        to.setClientSecret(from.getClientSecret());
        to.setAppKey(from.getAppKey());
        to.setRedirectUri(from.getRedirectUri());
        to.setScopes(from.getScopes());
        to.setLoginEndpoint(from.getLoginEndpoint());
        to.setRegisterEndpoint(from.getRegisterEndpoint());
    }

    private void requireToken(String setupToken) {
        if (!setupTokens.matches(setupToken)) {
            // Naming the host matters when several instances (dev/qa, replicas) sit behind one address:
            // each has its own token, and this says whose log or file to read.
            throw new ConnectException(403, "Setup token is incorrect for this server (host " + hostName()
                    + "). Read it from that instance: its startup log, or " + setupTokens.tokenFile() + ".");
        }
    }

    /** In Docker this is the container ID, matching the NAMES/ID column of {@code docker ps}. */
    private static String hostName() {
        try {
            return java.net.InetAddress.getLocalHost().getHostName();
        } catch (java.net.UnknownHostException e) {
            return "unknown";
        }
    }

    private static String requireHttpUrl(String value, String label) {
        if (!isSet(value)) {
            throw new ConnectException(400, label + " is required.");
        }
        URI uri;
        try {
            uri = URI.create(value.trim());
        } catch (IllegalArgumentException e) {
            throw new ConnectException(400, label + " is not a valid URL.");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (uri.getHost() == null || !(scheme.equals("https")
                || (scheme.equals("http") && LOOPBACK.contains(uri.getHost().toLowerCase(Locale.ROOT))))) {
            throw new ConnectException(400, label + " must be an https:// URL (http:// only for localhost).");
        }
        return scheme + "://" + uri.getRawAuthority() + stripSlash(uri.getRawPath() == null ? "" : uri.getRawPath());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Map<String, Object> parent, String key) {
        return parent != null && parent.get(key) instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
    }

    private static String portalMessage(RestClientResponseException e) {
        try {
            var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(e.getResponseBodyAsString());
            if (node.hasNonNull("message")) {
                return node.get("message").asText();
            }
        } catch (Exception ignored) {
        }
        return "HTTP " + e.getStatusCode().value();
    }

    private static String s256(String verifier) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] randomBytes(int n) {
        byte[] bytes = new byte[n];
        RANDOM.nextBytes(bytes);
        return bytes;
    }

    private static boolean isSet(String value) {
        return value != null && !value.isBlank();
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String stripSlash(String value) {
        return value == null ? null : value.trim().replaceAll("/+$", "");
    }

    /** A failure the operator can act on, with the HTTP status to report it as. */
    public static class ConnectException extends RuntimeException {
        private final int status;

        public ConnectException(int status, String message) {
            super(message);
            this.status = status;
        }

        public int getStatus() {
            return status;
        }
    }
}
