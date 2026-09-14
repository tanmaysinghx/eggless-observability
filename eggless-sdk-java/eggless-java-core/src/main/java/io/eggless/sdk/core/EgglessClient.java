package io.eggless.sdk.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.eggless.sdk.core.model.LogPayload;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

public class EgglessClient implements AutoCloseable {
    private final EgglessConfig config;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final BlockingQueue<LogPayload> queue;
    private final ScheduledExecutorService scheduler;
    private final ExecutorService sendExecutor;
    private volatile boolean running = true;

    public EgglessClient(EgglessConfig config) {
        this.config = config != null ? config : new EgglessConfig();
        this.objectMapper = new ObjectMapper();
        this.queue = new LinkedBlockingQueue<>(10000);
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();

        this.sendExecutor = Executors.newFixedThreadPool(2, r -> {
            Thread t = new Thread(r, "eggless-sender");
            t.setDaemon(true);
            return t;
        });

        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "eggless-flusher");
            t.setDaemon(true);
            return t;
        });

        if (this.config.isEnabled()) {
            this.scheduler.scheduleAtFixedRate(
                    this::flush,
                    this.config.getFlushIntervalMs(),
                    this.config.getFlushIntervalMs(),
                    TimeUnit.MILLISECONDS
            );
        }

        Runtime.getRuntime().addShutdownHook(new Thread(this::close));
    }

    public void send(LogPayload payload) {
        if (!config.isEnabled() || payload == null) {
            return;
        }

        if (payload.getService() == null || payload.getService().isEmpty()) {
            payload.setService(config.getServiceName());
        }
        if (payload.getEnvironment() == null || payload.getEnvironment().isEmpty()) {
            payload.setEnvironment(config.getEnvironment());
        }
        if (payload.getHost() == null || payload.getHost().isEmpty()) {
            payload.setHost(config.getHost());
        }

        boolean accepted = queue.offer(payload);
        if (!accepted) {
            // Queue full, drain immediately to avoid dropping logs
            sendExecutor.submit(this::flush);
        }

        if (queue.size() >= config.getBatchSize()) {
            sendExecutor.submit(this::flush);
        }
    }

    public synchronized void flush() {
        if (queue.isEmpty()) {
            return;
        }

        List<LogPayload> batch = new ArrayList<>();
        queue.drainTo(batch, config.getBatchSize());

        for (LogPayload payload : batch) {
            try {
                String json = objectMapper.writeValueAsString(payload);
                String endpoint = config.getServerUrl() + "/api/v1/logs/ingest";

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(endpoint))
                        .header("Content-Type", "application/json")
                        .header("X-API-Key", config.getApiKey())
                        .POST(HttpRequest.BodyPublishers.ofString(json))
                        .timeout(Duration.ofSeconds(4))
                        .build();

                httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                        .exceptionally(ex -> null);
            } catch (Exception ignored) {
                // Silently prevent logging errors from failing application threads
            }
        }
    }

    @Override
    public void close() {
        if (!running) return;
        running = false;

        try {
            flush();
            scheduler.shutdown();
            sendExecutor.shutdown();
            scheduler.awaitTermination(2, TimeUnit.SECONDS);
            sendExecutor.awaitTermination(2, TimeUnit.SECONDS);
        } catch (Exception ignored) {
        }
    }

    public EgglessConfig getConfig() {
        return config;
    }
}
