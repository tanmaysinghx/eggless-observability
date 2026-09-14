package io.eggless.sdk.spring;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "eggless")
public class EgglessProperties {
    private boolean enabled = true;
    private String serverUrl = "http://localhost:8080";
    private String apiKey = "egg_live_998877665544332211";
    private String serviceName = "spring-boot-service";
    private String environment = "production";
    private int batchSize = 50;
    private long flushIntervalMs = 1500;
    private boolean traceFilterEnabled = true;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getServerUrl() {
        return serverUrl;
    }

    public void setServerUrl(String serverUrl) {
        this.serverUrl = serverUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getServiceName() {
        return serviceName;
    }

    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }

    public String getEnvironment() {
        return environment;
    }

    public void setEnvironment(String environment) {
        this.environment = environment;
    }

    public int getBatchSize() {
        return batchSize;
    }

    public void setBatchSize(int batchSize) {
        this.batchSize = batchSize;
    }

    public long getFlushIntervalMs() {
        return flushIntervalMs;
    }

    public void setFlushIntervalMs(long flushIntervalMs) {
        this.flushIntervalMs = flushIntervalMs;
    }

    public boolean isTraceFilterEnabled() {
        return traceFilterEnabled;
    }

    public void setTraceFilterEnabled(boolean traceFilterEnabled) {
        this.traceFilterEnabled = traceFilterEnabled;
    }
}
