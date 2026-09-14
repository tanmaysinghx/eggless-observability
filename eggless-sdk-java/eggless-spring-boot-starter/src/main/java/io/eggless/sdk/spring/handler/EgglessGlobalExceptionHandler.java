package io.eggless.sdk.spring.handler;

import io.eggless.sdk.core.EgglessClient;
import io.eggless.sdk.core.model.LogPayload;
import io.eggless.sdk.spring.EgglessProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
@Order(Ordered.LOWEST_PRECEDENCE)
public class EgglessGlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(EgglessGlobalExceptionHandler.class);
    private final EgglessClient egglessClient;
    private final EgglessProperties properties;

    public EgglessGlobalExceptionHandler(EgglessClient egglessClient, EgglessProperties properties) {
        this.egglessClient = egglessClient;
        this.properties = properties;
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleAllExceptions(Exception ex) {
        log.error("Uncaught exception intercepted by Eggless SDK: {}", ex.getMessage(), ex);

        StringWriter sw = new StringWriter();
        ex.printStackTrace(new PrintWriter(sw));

        LogPayload payload = new LogPayload();
        payload.setService(properties.getServiceName());
        payload.setLevel("ERROR");
        payload.setMessage("Uncaught Exception: " + ex.getClass().getSimpleName() + " - " + ex.getMessage());
        payload.setEnvironment(properties.getEnvironment());
        payload.setTraceId(MDC.get("traceId"));
        payload.setRequestId(MDC.get("requestId"));
        payload.setUserId(MDC.get("userId"));
        payload.setStackTrace(sw.toString());

        payload.addMetadata("exceptionType", ex.getClass().getName());
        payload.addMetadata("httpMethod", MDC.get("httpMethod"));
        payload.addMetadata("httpUri", MDC.get("httpUri"));

        if (egglessClient != null) {
            egglessClient.send(payload);
        }

        Map<String, Object> body = new HashMap<>();
        body.put("success", false);
        body.put("error", ex.getClass().getSimpleName());
        body.put("message", ex.getMessage());
        body.put("traceId", MDC.get("traceId"));

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}
