# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------------------------
# 1. Angular Client Build Stage
# ---------------------------------------------------------------------------------------------
FROM node:24-alpine AS client-builder

WORKDIR /build/eggless-client

COPY eggless-client/package.json eggless-client/package-lock.json ./
RUN npm ci

COPY eggless-client/ ./
RUN npm run build

# ---------------------------------------------------------------------------------------------
# 2. Spring Boot Server Build Stage
# ---------------------------------------------------------------------------------------------
FROM eclipse-temurin:25-jdk AS server-builder

WORKDIR /build/eggless-server

COPY eggless-server/gradle/ gradle/
COPY eggless-server/gradlew eggless-server/build.gradle eggless-server/settings.gradle ./
RUN chmod +x gradlew

COPY eggless-server/src/ src/

# Bundle frontend assets into Spring Boot static resources
COPY --from=client-builder /build/eggless-client/dist/eggless-client/browser/ src/main/resources/static/

RUN ./gradlew bootJar -x test

# ---------------------------------------------------------------------------------------------
# 3. Lean Runtime Stage
# ---------------------------------------------------------------------------------------------
FROM eclipse-temurin:25-jre-alpine AS runtime

LABEL maintainer="Tanmay Singh <tanmay@tanmaysinghx.com>"
LABEL description="Eggless Observability - Free Open-Source Log Observability Platform"

RUN addgroup -S eggless && adduser -S eggless -G eggless
USER eggless

WORKDIR /app

COPY --from=server-builder --chown=eggless:eggless /build/eggless-server/build/libs/eggless-observability.jar app.jar

ENV SERVER_PORT=8080 \
    EGGLESS_HOME=/home/eggless/.eggless

EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseZGC", "-Xmx512m", "-jar", "app.jar"]
