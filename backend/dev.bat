@echo off
REM Versao .bat do dev.ps1 — pra quem prefere cmd.exe ao inves de PowerShell.
REM Uso:  dev.bat

if not exist target\kaizen-api-java-1.0.0.jar (
    echo.
    echo Jar nao encontrado. Rode primeiro: mvn package -DskipTests
    echo.
    exit /b 1
)

set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=kaizen local
set DB_USER=postgres
set PORT=8081
set TZ=America/Sao_Paulo
set SPRING_PROFILES_ACTIVE=local
set NODE_ENV=development
set SSO_ENABLED=false

echo.
echo Iniciando backend Java em http://localhost:%PORT%
echo Para parar: Ctrl+C
echo.

java "-Duser.timezone=America/Sao_Paulo" -jar target\kaizen-api-java-1.0.0.jar
