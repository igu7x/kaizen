# Dockerfile multistage para kaizen-api-java
#
# Stage 1 (build): roda mvn dentro de uma imagem com JDK 21 + Maven, gera o jar.
# Stage 2 (runtime): JRE 21 minimal, copia só o jar e as configurações.
#
# Imagens base usam Red Hat UBI — recomendadas para OpenShift por padronização e
# por já virem com root group writable (compatível com o random UID do OpenShift).
# Se sua infra usa Quay/Harbor com mirrors específicos, ajuste as referências.

# ============================================================
# Stage 1 — Build
# ============================================================
FROM registry.access.redhat.com/ubi9/openjdk-21:latest AS build

USER root
WORKDIR /workspace

# Copia só os arquivos do Maven primeiro pra aproveitar cache de dependências
COPY pom.xml ./
RUN mvn -B -q dependency:go-offline

# Agora copia o código e builda
COPY src ./src
RUN mvn -B -q clean package -DskipTests

# Move o jar pra um nome estável
RUN cp /workspace/target/kaizen-api-java-*.jar /workspace/app.jar

# ============================================================
# Stage 2 — Runtime
# ============================================================
FROM registry.access.redhat.com/ubi9/openjdk-21-runtime:latest

# Timezone — CRÍTICO: o fix C do Sprint 11 assume America/Sao_Paulo para
# serializar java.sql.Date. Mudar isso quebra paridade byte-a-byte com o Node.
ENV TZ=America/Sao_Paulo

# Pasta pra uploads (se a aplicação grava arquivos localmente; ajustar se for S3/PVC)
USER root
RUN mkdir -p /app/uploads && chgrp -R 0 /app && chmod -R g+rwX /app
USER 185

WORKDIR /app
COPY --from=build /workspace/app.jar /app/app.jar

# Porta padrão do Spring Boot da aplicação (PORT=8081 no application.yml).
# OpenShift faz port-mapping pelo Service; aqui só expõe pra clareza.
EXPOSE 8081

# Healthcheck via Actuator. OpenShift usa probes próprias no Deployment,
# mas deixar aqui ajuda em docker-compose / debug local.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:8081/actuator/health || exit 1

# Flags JVM: heap baseado em cgroup (OpenShift seta limits via downward API),
# saída UTF-8 pra logs em pt-BR.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -Dfile.encoding=UTF-8 -Duser.timezone=America/Sao_Paulo"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
