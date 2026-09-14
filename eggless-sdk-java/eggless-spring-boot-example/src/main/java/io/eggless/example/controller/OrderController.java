package io.eggless.example.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
    private static final Logger log = LoggerFactory.getLogger(OrderController.class);

    @GetMapping
    public ResponseEntity<Map<String, Object>> getOrders() {
        log.info("Fetching recent orders list for dashboard");
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("ordersCount", 142);
        response.put("traceId", MDC.get("traceId"));
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createOrder(@RequestBody Map<String, Object> orderRequest) {
        String orderId = "ord-" + UUID.randomUUID().toString().substring(0, 8);
        log.info("Processing order creation for orderId={}, amount={}", orderId, orderRequest.getOrDefault("amount", 99.99));
        
        log.warn("High demand detected for item SKU-9921, processing asynchronously");

        Map<String, Object> response = new HashMap<>();
        response.put("orderId", orderId);
        response.put("status", "CREATED");
        response.put("traceId", MDC.get("traceId"));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/simulate-error")
    public ResponseEntity<Map<String, Object>> simulateError() {
        log.error("Failed to connect to external Payment Gateway provider service after 3 retries");
        throw new IllegalStateException("Payment Gateway Timeout (504): Provider host api.payments.internal unreachable");
    }
}
