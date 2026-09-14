package io.eggless.sdk.spring;

import io.eggless.sdk.core.EgglessClient;
import io.eggless.sdk.core.EgglessConfig;
import io.eggless.sdk.spring.filter.EgglessTraceFilter;
import io.eggless.sdk.spring.handler.EgglessGlobalExceptionHandler;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@EnableConfigurationProperties(EgglessProperties.class)
@ConditionalOnProperty(prefix = "eggless", name = "enabled", havingValue = "true", matchIfMissing = true)
public class EgglessAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public EgglessClient egglessClient(EgglessProperties properties) {
        EgglessConfig config = EgglessConfig.builder()
                .serverUrl(properties.getServerUrl())
                .apiKey(properties.getApiKey())
                .serviceName(properties.getServiceName())
                .environment(properties.getEnvironment())
                .batchSize(properties.getBatchSize())
                .flushIntervalMs(properties.getFlushIntervalMs())
                .enabled(properties.isEnabled())
                .build();
        return new EgglessClient(config);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "eggless", name = "trace-filter-enabled", havingValue = "true", matchIfMissing = true)
    public EgglessTraceFilter egglessTraceFilter() {
        return new EgglessTraceFilter();
    }

    @Bean
    @ConditionalOnMissingBean
    public EgglessGlobalExceptionHandler egglessGlobalExceptionHandler(EgglessClient egglessClient, EgglessProperties properties) {
        return new EgglessGlobalExceptionHandler(egglessClient, properties);
    }
}
