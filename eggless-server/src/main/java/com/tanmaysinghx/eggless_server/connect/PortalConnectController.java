package com.tanmaysinghx.eggless_server.connect;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Map;

/**
 * "Connect with Portal SSO" endpoints used by the /setup screen. Starting and disconnecting need the
 * setup token; the callback is reached by Portal's redirect and is safe without it because only a
 * request this server submitted (and holds the verifier for) can be completed.
 */
@RestController
@RequestMapping("/api/portal-connect")
public class PortalConnectController {

    private final PortalConnectService connectService;

    public PortalConnectController(PortalConnectService connectService) {
        this.connectService = connectService;
    }

    public record StartRequest(String portalUrl, String publicUrl, String setupToken) {}

    public record TokenRequest(String setupToken) {}

    @GetMapping("/status")
    public PortalConnectService.Status status() {
        return connectService.status();
    }

    @PostMapping("/start")
    public Map<String, String> start(@RequestBody StartRequest request) {
        return Map.of("approvalUrl", connectService.start(request.portalUrl(), request.publicUrl(), request.setupToken()));
    }

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(name = "request_id", required = false) String requestId,
            @RequestParam(name = "code", required = false) String code,
            @RequestParam(name = "error", required = false) String error) {
        UriComponentsBuilder target = UriComponentsBuilder.fromPath("/setup");
        try {
            connectService.complete(requestId, code, error);
            target.queryParam("status", "connected");
        } catch (PortalConnectService.ConnectException e) {
            target.queryParam("status", e.getStatus() == 403 ? "denied" : "error").queryParam("message", e.getMessage());
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, URI.create(target.encode().build().toUriString()).toString())
                // The Portal URL in the browser's history carried the one-time code; don't forward it.
                .header("Referrer-Policy", "no-referrer")
                .build();
    }

    @PostMapping("/disconnect")
    public ResponseEntity<Void> disconnect(@RequestBody TokenRequest request) {
        connectService.disconnect(request.setupToken());
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(PortalConnectService.ConnectException.class)
    public ResponseEntity<Map<String, String>> handle(PortalConnectService.ConnectException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("message", e.getMessage()));
    }
}
