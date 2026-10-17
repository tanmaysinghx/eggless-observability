@echo off
setlocal enabledelayedexpansion

REM Eggless Observability - Windows Build Script
REM Builds Angular frontend and Spring Boot backend into a single executable JAR

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo ==========================================================
echo   Building Eggless Observability (Single Executable JAR)
echo ==========================================================

REM 1. Check Java
where java >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: java is not installed or not in PATH.
    echo Eggless Observability requires Java 25+.
    exit /b 1
)

REM 2. Build Angular frontend
echo ==> [1/3] Building Angular UI (eggless-client)...
cd /d "%SCRIPT_DIR%eggless-client"
if not exist "node_modules" (
    echo Installing dependencies...
    call npm ci
)
call npm run build
if %errorlevel% neq 0 (
    echo Failed to build frontend.
    exit /b %errorlevel%
)

REM 3. Copy client assets to server static resources
echo ==> [2/3] Bundling Angular UI into Spring Boot static resources...
if not exist "%SCRIPT_DIR%eggless-server\src\main\resources\static" (
    mkdir "%SCRIPT_DIR%eggless-server\src\main\resources\static"
)
xcopy /s /y /q "%SCRIPT_DIR%eggless-client\dist\eggless-client\browser\*" "%SCRIPT_DIR%eggless-server\src\main\resources\static\"

REM 4. Package Spring Boot executable
echo ==> [3/3] Packaging Spring Boot executable JAR (eggless-server)...
cd /d "%SCRIPT_DIR%eggless-server"
call gradlew.bat bootJar -x test
if %errorlevel% neq 0 (
    echo Failed to package Spring Boot JAR.
    exit /b %errorlevel%
)

copy /y "%SCRIPT_DIR%eggless-server\build\libs\eggless-observability.jar" "%SCRIPT_DIR%eggless-observability.jar"

echo.
echo ==========================================================
echo   Build Complete! Single Executable Ready:
echo   %SCRIPT_DIR%eggless-observability.jar
echo ==========================================================
echo.
echo Quick Run (Default Embedded H2 Database):
echo   java -jar eggless-observability.jar
echo.
echo Custom Database (PostgreSQL):
echo   set DB_URL=jdbc:postgresql://localhost:5432/eggless
echo   set DB_USERNAME=postgres
echo   set DB_PASSWORD=secret
echo   java -jar eggless-observability.jar
echo.
echo Custom Database (MySQL):
echo   set DB_URL=jdbc:mysql://localhost:3306/eggless
echo   set DB_USERNAME=root
echo   set DB_PASSWORD=secret
echo   java -jar eggless-observability.jar
echo.
echo Web UI & APIs available at: http://localhost:8080
cd /d "%SCRIPT_DIR%"
