package io.eggless.sdk.core;

import java.net.InetAddress;

public class EgglessConfig {
    private String serverUrl = "http://localhost:8080";
    private String apiKey = "egg_live_998877665544332211";
    private String serviceName = "java-application";
    private String environment = "production";
    private String host;
    private boolean enabled = true;
    private int batchSize = 50;
    private long flushIntervalMs = 1500;

    public EgglessConfig() {
        try {
            this.host = InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            this.host = "localhost";
        }
    }

    public static Builder builder() {
        return new Builder();
    }

    public String getServerUrl() {
        return serverUrl;
    }

    public void setServerUrl(String serverUrl) {
        if (serverUrl != null && serverUrl.endsWith("/")) {
            this.serverUrl = serverUrl.substring(0, serverUrl.length() - 1);
        } else {
            this.serverUrl = serverUrl;
        }
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

    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
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

    public static class Builder {
        private final EgglessConfig config = new EgglessConfig();

        public Builder serverUrl(String serverUrl) {
            config.setServerUrl(serverUrl);
            return this;
        }

        public Builder apiKey(String apiKey) {
            config.setApiKey(apiKey);
            return this;
        }

        public Builder serviceName(String serviceName) {
            config.setServiceName(serviceName);
            return this;
        }

        public Builder environment(String environment) {
            config.setEnvironment(environment);
            return this;
        }

        public Builder host(String host) {
            config.setHost(host);
            return this;
        }

        public Builder enabled(boolean enabled) {
            config.setEnabled(enabled);
            return this;
        }

        public Builder batchSize(int batchSize) {
            config.setBatchSize(batchSize);
            return this;
        }

        public Builder flushIntervalMs(long flushIntervalMs) {
            config.setFlushIntervalMs(flushIntervalMs);
            return this;
        }

        public EgglessConfig build() {
            return config;
        }
    }
}
