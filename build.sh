#!/usr/bin/env bash
set -euo pipefail

# Eggless Observability - Root Build Script
# Builds the Angular frontend client and Spring Boot backend into a single executable JAR:
# eggless-server/build/libs/eggless-observability.jar

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Building Eggless Observability (Single Executable JAR) ==="

# 1. Verify Java 25+
if ! command -v java >/dev/null 2>&1; then
    echo "Error: java is not installed or not in PATH."
    echo "Eggless Observability requires Java 25+."
    exit 1
fi

JAVA_MAJOR_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
echo "Detected Java Version: $JAVA_MAJOR_VERSION"

# 2. Build Angular frontend
echo "==> [1/3] Building Angular UI (eggless-client)..."
cd "$SCRIPT_DIR/eggless-client"
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm ci
fi
npm run build

# 3. Copy client assets to server static resources
echo "==> [2/3] Bundling Angular UI into Spring Boot static resources..."
mkdir -p "$SCRIPT_DIR/eggless-server/src/main/resources/static"
cp -r "$SCRIPT_DIR/eggless-client/dist/eggless-client/browser/"* "$SCRIPT_DIR/eggless-server/src/main/resources/static/"

# 4. Package Spring Boot executable
echo "==> [3/3] Packaging Spring Boot executable JAR (eggless-server)..."
cd "$SCRIPT_DIR/eggless-server"
chmod +x gradlew
./gradlew bootJar -x test

# Copy jar to root for convenience
cp "$SCRIPT_DIR/eggless-server/build/libs/eggless-observability.jar" "$SCRIPT_DIR/eggless-observability.jar"

echo ""
echo "=========================================================="
echo "  Build Complete! Single Executable Ready:"
echo "  $SCRIPT_DIR/eggless-observability.jar"
echo "=========================================================="
echo ""
echo "Quick Run (Default Embedded H2 Database):"
echo "  java -jar eggless-observability.jar"
echo ""
echo "Custom Database (PostgreSQL):"
echo "  DB_URL=jdbc:postgresql://localhost:5432/eggless DB_USERNAME=postgres DB_PASSWORD=secret java -jar eggless-observability.jar"
echo ""
echo "Custom Database (MySQL):"
echo "  DB_URL=jdbc:mysql://localhost:3306/eggless DB_USERNAME=root DB_PASSWORD=secret java -jar eggless-observability.jar"
echo ""
echo "Web UI & APIs available at: http://localhost:8080"
