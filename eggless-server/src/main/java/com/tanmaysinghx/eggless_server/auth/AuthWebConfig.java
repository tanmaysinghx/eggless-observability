package com.tanmaysinghx.eggless_server.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class AuthWebConfig implements WebMvcConfigurer {

    private final SessionInterceptor sessionInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // The live-tail socket is checked by SessionHandshakeInterceptor.
        registry.addInterceptor(sessionInterceptor)
                .addPathPatterns("/api/v1/**")
                .excludePathPatterns("/api/v1/logs/stream");
    }
}
