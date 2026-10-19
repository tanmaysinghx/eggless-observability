package com.tanmaysinghx.eggless_server.websocket;

import com.tanmaysinghx.eggless_server.auth.SessionHandshakeInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final LogStreamWebSocketHandler logStreamWebSocketHandler;
    private final SessionHandshakeInterceptor sessionHandshakeInterceptor;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Same-origin only (Spring's default): the socket is authenticated by the session cookie.
        registry.addHandler(logStreamWebSocketHandler, "/api/v1/logs/stream")
                .addInterceptors(sessionHandshakeInterceptor);
    }
}
