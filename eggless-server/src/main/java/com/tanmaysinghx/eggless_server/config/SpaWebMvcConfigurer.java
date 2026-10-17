package com.tanmaysinghx.eggless_server.config;

import java.io.IOException;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the Angular client single-page application from classpath:/static/
 * and forwards all client-side routes (/logs, /overview, /settings, /login, /auth/callback, etc.)
 * to index.html without interfering with backend API and WebSocket endpoints.
 */
@Configuration
public class SpaWebMvcConfigurer implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        Resource requestedResource = location.createRelative(resourcePath);
                        if (requestedResource.exists() && requestedResource.isReadable()) {
                            return requestedResource;
                        }

                        // Do not route backend endpoints or websockets to index.html
                        if (resourcePath.startsWith("api")
                                || resourcePath.startsWith("ws")
                                || resourcePath.startsWith("actuator")
                                || resourcePath.startsWith("h2-console")) {
                            return null;
                        }

                        // Files with extensions (.js, .css, .png, etc.) that do not exist should 404
                        String lastSegment = resourcePath.substring(resourcePath.lastIndexOf('/') + 1);
                        if (lastSegment.contains(".")) {
                            return null;
                        }

                        // Client-side Angular HTML5 routes forward to index.html
                        Resource index = location.createRelative("index.html");
                        if (index.exists() && index.isReadable()) {
                            return index;
                        }
                        return null;
                    }
                });
    }
}
