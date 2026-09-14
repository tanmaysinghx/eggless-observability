package io.eggless.sdk.logback;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.IThrowableProxy;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.UnsynchronizedAppenderBase;
import io.eggless.sdk.core.EgglessClient;
import io.eggless.sdk.core.EgglessConfig;
import io.eggless.sdk.core.model.LogPayload;

import java.util.Map;

public class EgglessLogbackAppender extends UnsynchronizedAppenderBase<ILoggingEvent> {
    private String serverUrl = "http://localhost:8080";
    private String apiKey = "egg_live_998877665544332211";
    private String serviceName = "java-logback-app";
    private String environment = "production";

    private EgglessClient client;

    @Override
    public void start() {
        EgglessConfig config = EgglessConfig.builder()
                .serverUrl(serverUrl)
                .apiKey(apiKey)
                .serviceName(serviceName)
                .environment(environment)
                .build();
        this.client = new EgglessClient(config);
        super.start();
    }

    @Override
    protected void append(ILoggingEvent event) {
        if (event == null || client == null) {
            return;
        }

        LogPayload payload = new LogPayload();
        payload.setService(serviceName);
        payload.setLevel(event.getLevel().toString());
        payload.setMessage(event.getFormattedMessage());
        payload.setEnvironment(environment);

        Map<String, String> mdcPropertyMap = event.getMDCPropertyMap();
        if (mdcPropertyMap != null && !mdcPropertyMap.isEmpty()) {
            if (mdcPropertyMap.containsKey("traceId")) {
                payload.setTraceId(mdcPropertyMap.get("traceId"));
            }
            if (mdcPropertyMap.containsKey("requestId")) {
                payload.setRequestId(mdcPropertyMap.get("requestId"));
            }
            if (mdcPropertyMap.containsKey("userId")) {
                payload.setUserId(mdcPropertyMap.get("userId"));
            }
            for (Map.Entry<String, String> entry : mdcPropertyMap.entrySet()) {
                payload.addMetadata(entry.getKey(), entry.getValue());
            }
        }

        payload.addMetadata("loggerName", event.getLoggerName());
        payload.addMetadata("threadName", event.getThreadName());

        IThrowableProxy throwableProxy = event.getThrowableProxy();
        if (throwableProxy != null) {
            payload.setStackTrace(ThrowableProxyUtil.asString(throwableProxy));
        }

        client.send(payload);
    }

    @Override
    public void stop() {
        if (client != null) {
            client.close();
        }
        super.stop();
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
}
