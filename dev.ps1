# Sobe o backend Java em modo desenvolvimento.
# Equivalente ao `npm run dev` do frontend.
#
# Uso:
#   .\dev.ps1
#
# Pré-requisito (UMA vez, ou sempre que mudar código):
#   mvn package -DskipTests
#
# Para parar: Ctrl+C nesta janela.

$ErrorActionPreference = "Stop"

# Verificar se o jar existe
$jar = "target\kaizen-api-java-1.0.0.jar"
if (-not (Test-Path $jar)) {
    Write-Host ""
    Write-Host "Jar não encontrado em $jar" -ForegroundColor Red
    Write-Host "Rode primeiro: mvn package -DskipTests" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Variáveis de ambiente — alinhadas com o backend Node (banco "kaizen local",
# porta 8081, timezone São Paulo). Senha do banco vem do application-local.yml
# (não versionado).
$env:DB_HOST              = "localhost"
$env:DB_PORT              = "5432"
$env:DB_NAME              = "kaizen local"
$env:DB_USER              = "postgres"
$env:PORT                 = "8081"
$env:TZ                   = "America/Sao_Paulo"
$env:SPRING_PROFILES_ACTIVE = "local"
$env:NODE_ENV             = "development"
$env:SSO_ENABLED          = "false"

Write-Host ""
Write-Host "🚀 Iniciando backend Java em http://localhost:$($env:PORT)" -ForegroundColor Green
Write-Host "   Profile: $($env:SPRING_PROFILES_ACTIVE)   |   Banco: $($env:DB_NAME)"
Write-Host "   Para parar: Ctrl+C"
Write-Host ""

java "-Duser.timezone=America/Sao_Paulo" -jar $jar
