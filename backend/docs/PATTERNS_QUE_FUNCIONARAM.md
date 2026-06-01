# PATTERNS QUE FUNCIONARAM — receitas validadas na 1ª tentativa

> Este documento lista as **decisões de design que se provaram corretas** durante a primeira tentativa de migração. Use-as desde o início, sem precisar redescobrir.

---

## 1. Stack confirmado

```xml
<!-- pom.xml — dependências essenciais validadas -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>compile</scope>  <!-- NÃO usar runtime, precisa compile -->
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.6</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>
</dependency>
<!-- Pra contract tests (Sprint 10) -->
<dependency>
    <groupId>io.rest-assured</groupId>
    <artifactId>rest-assured</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>net.javacrumbs.json-unit</groupId>
    <artifactId>json-unit-assertj</artifactId>
    <scope>test</scope>
</dependency>
```

**Versões fixadas que funcionaram**:
- Spring Boot **3.3.5** (LTS estável)
- Java **21 LTS** (Temurin)
- Maven **3.9.16**
- JJWT **0.12.6**

---

## 2. `application.yml` validado

```yaml
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:kaizen_java_dev}
    username: ${DB_USER:postgres}
    password: ${DB_PASSWORD:Galo2013$}
    hikari:
      maximum-pool-size: 10
  servlet:
    multipart:
      max-file-size: 10MB           # 10 MB pra paridade com Multer do Node em upload PDF
      max-request-size: 10MB
  jackson:
    serialization:
      write-dates-as-timestamps: false
    default-property-inclusion: ALWAYS  # null fields aparecem no JSON (como o Node)

server:
  port: ${PORT:8081}                  # Java em 8081; Node em 8080

kaizen:
  sso:
    enabled: ${SSO_ENABLED:false}
    realm: ${KEYCLOAK_REALM:}
    client-id: ${KEYCLOAK_CLIENT_ID:}
    keycloak-url: ${KEYCLOAK_URL:}
    redirect-uri: ${KEYCLOAK_REDIRECT_URI:}
  frontend:
    url: ${FRONTEND_URL:http://localhost:5173}
  node-env: ${NODE_ENV:development}
  jwt-secret: ${JWT_SECRET:}
  cors:
    extra-origins: ${CORS_ORIGINS:}

logging:
  level:
    org.springframework.security: INFO
    org.springframework.jdbc.core.JdbcTemplate: INFO
```

E `application-local.yml`:
```yaml
spring:
  profiles:
    active: local
```

---

## 3. Estrutura de pacotes validada

```
br.jus.tjgo.kaizen/
├── KaizenApplication.java
├── config/
│   ├── KaizenCorsFilter.java        # CORS byte-a-byte com Node
│   ├── SecurityConfig.java          # Stateless, permitAll, JwtAuthenticationFilter
│   ├── JacksonConfig.java           # Serializers customizados
│   ├── WebMvcConfig.java            # /uploads/** + criação de pastas
│   ├── KaizenSsoProperties.java
│   └── KaizenFrontendProperties.java
├── auth/
│   ├── JwtAuthenticationFilter.java # Permissivo (Keycloak + base64)
│   ├── AuthContext.java             # currentUserId(), requestUserId(), requireRole(), requireKRUpdate()
│   ├── AuthenticatedUser.java       # record { id, name, email, role, ... }
│   └── UserRepository.java          # findAuthById, findAuthByEmail (filtra is_deleted=FALSE)
├── controller/
│   ├── HealthController.java
│   ├── AuthController.java
│   ├── UserController.java
│   ├── AreasController.java         # + UnidadesController embutido
│   ├── PessoasController.java
│   ├── PermissoesController.java
│   ├── AmbientesController.java
│   ├── ColaboradoresController.java
│   ├── OkrController.java
│   ├── MetasController.java
│   ├── PlanosProgramasController.java
│   ├── GestaoEstrategicaController.java
│   ├── SprintsController.java
│   ├── ContratosController.java     # Projetos + Entregas + TAP + TEP
│   ├── PcaItemsController.java      # combina pca.ts + pca-details.ts
│   ├── PcaRenovacoesController.java
│   ├── PcaRenovacoesDetailsController.java
│   ├── ComitesController.java       # Reuniões + atas embutidos
│   ├── FormsController.java
│   ├── CompetenciasPadraoController.java
│   ├── AutoavaliacaoController.java
│   ├── AvaliacaoGestorController.java
│   ├── AvaliacaoIntegradaController.java
│   ├── CompetenciasGestorController.java   # + tecnicas-admin embutido
│   ├── ProcessosNegocioController.java
│   └── HomeController.java
├── service/
│   └── ... (1 por domínio)
├── repository/
│   └── ... (1 por domínio)
├── dto/
│   ├── auth/
│   ├── user/
│   ├── avaliacao/
│   └── ... (records imutáveis pra request/response)
├── util/
│   ├── JsonbHelper.java             # Conversão JSON ↔ PGobject
│   ├── PasswordHasher.java          # SHA-256 (paridade Node)
│   └── ContractConstants.java       # (test) URLs Node/Java, lista de paths voláteis
├── entity/
│   └── User.java                    # única entity (poucos lugares onde Map não dá conta)
└── exception/
    ├── ApiException.java            # RuntimeException com statusCode
    └── GlobalExceptionHandler.java  # @ControllerAdvice
```

---

## 4. `JacksonConfig.java` completo (copia direto)

```java
@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        DateTimeFormatter isoWithMillis = DateTimeFormatter
            .ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
            .withZone(ZoneOffset.UTC);

        SimpleModule module = new SimpleModule();

        // Instant / OffsetDateTime → ISO com .SSSZ (paridade Node Date.toISOString())
        module.addSerializer(Instant.class, new JsonSerializer<Instant>() {
            @Override
            public void serialize(Instant value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                gen.writeString(isoWithMillis.format(value));
            }
        });
        module.addSerializer(OffsetDateTime.class, new JsonSerializer<OffsetDateTime>() {
            @Override
            public void serialize(OffsetDateTime value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                gen.writeString(isoWithMillis.format(value.toInstant()));
            }
        });

        // java.sql.Date → ISO com 00:00:00.000Z (NOTA: registrar ANTES de java.util.Date)
        module.addSerializer(java.sql.Date.class, new JsonSerializer<java.sql.Date>() {
            @Override
            public void serialize(java.sql.Date value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                Instant instant = value.toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant();
                gen.writeString(isoWithMillis.format(instant));
            }
        });

        // java.util.Date / java.sql.Timestamp → ISO
        module.addSerializer(java.util.Date.class, new JsonSerializer<java.util.Date>() {
            @Override
            public void serialize(java.util.Date value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                gen.writeString(isoWithMillis.format(value.toInstant()));
            }
        });

        // java.sql.Array → JSON array nativo (resolve caminho, areas_vinculadas_ids, etc.)
        module.addSerializer(java.sql.Array.class, new JsonSerializer<java.sql.Array>() {
            @Override
            public void serialize(java.sql.Array value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                Object[] elements = (Object[]) value.getArray();
                gen.writeStartArray();
                for (Object e : elements) gen.writeObject(e);
                gen.writeEndArray();
            }
        });

        // PGobject (JSONB) → JSON raw (resolve proprietarios, atores, documentos_anexados, etc.)
        module.addSerializer(org.postgresql.util.PGobject.class, new JsonSerializer<org.postgresql.util.PGobject>() {
            @Override
            public void serialize(org.postgresql.util.PGobject value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                String json = value.getValue();
                if (json == null || json.isEmpty()) {
                    gen.writeNull();
                } else {
                    gen.writeRawValue(json);
                }
            }
        });

        return new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .registerModule(module)
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .setSerializationInclusion(JsonInclude.Include.ALWAYS);
    }
}
```

---

## 5. `KaizenCorsFilter.java` (CORS byte-a-byte com Node)

Replica fielmente `server.ts` linhas 77-101:

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class KaizenCorsFilter extends OncePerRequestFilter {

    private static final List<String> ALLOWED_ORIGINS = List.of(
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:3000",
        "https://painel-sgjt-stag-frontend.apps.ocp-prd.tjgo.jus.br",
        "http://painel-sgjt-stag-frontend.apps.ocp-prd.tjgo.jus.br",
        "https://painel-sgjt-prd-frontend.apps.ocp-prd.tjgo.jus.br",
        "http://painel-sgjt-prd-frontend.apps.ocp-prd.tjgo.jus.br",
        "https://kaizen.tjgo.jus.br",
        "http://kaizen.tjgo.jus.br"
    );
    private static final Pattern TJGO_PATTERN = Pattern.compile(
        "^https?://([a-z0-9-]+\\.)*tjgo\\.jus\\.br$",
        Pattern.CASE_INSENSITIVE
    );

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String origin = req.getHeader("Origin");
        boolean isAllowedTjgo = origin != null && TJGO_PATTERN.matcher(origin).matches();

        if (origin != null && (ALLOWED_ORIGINS.contains(origin) || isAllowedTjgo)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
        } else if (origin == null) {
            res.setHeader("Access-Control-Allow-Origin", "*");
        }

        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-User-Role, X-User-Id, X-User-Diretoria");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Max-Age", "86400");

        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) {
            res.setStatus(HttpServletResponse.SC_OK);
            return;
        }

        chain.doFilter(req, res);
    }
}
```

---

## 6. `JwtAuthenticationFilter.java` permissivo (Keycloak + base64)

```java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final UserRepository userRepo;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String authHeader = req.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                AuthenticatedUser user = null;

                if (token.contains(".")) {
                    // JWT Keycloak — decodifica payload, busca por email
                    String[] parts = token.split("\\.");
                    if (parts.length >= 2) {
                        byte[] decoded = Base64.getUrlDecoder().decode(
                            parts[1] + "=".repeat((4 - parts[1].length() % 4) % 4)
                        );
                        JsonNode payload = objectMapper.readTree(decoded);
                        if (payload.has("email")) {
                            user = userRepo.findAuthByEmail(payload.get("email").asText()).orElse(null);
                        }
                    }
                } else {
                    // Base64 puro {"userId":N} — atalho de smoke test (paridade Node /api/auth/login)
                    byte[] decoded = Base64.getDecoder().decode(token);
                    JsonNode payload = objectMapper.readTree(decoded);
                    if (payload.has("userId")) {
                        user = userRepo.findAuthById(payload.get("userId").asLong()).orElse(null);
                    }
                }

                if (user != null) {
                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                        user, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + user.role()))
                    );
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception e) {
                log.warn("[Auth] Token inválido: {}", e.getMessage());
                // Permissivo: erro de token NÃO bloqueia, deixa passar sem auth
            }
        }
        chain.doFilter(req, res);
    }
}
```

---

## 7. `AuthContext.java` com dois helpers

```java
public final class AuthContext {

    private AuthContext() {}

    public static Optional<AuthenticatedUser> getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AuthenticatedUser u)) {
            return Optional.empty();
        }
        return Optional.of(u);
    }

    // Categoria A — permissivo (fallback userId=1)
    public static Long requestUserId() {
        return getCurrentUser().map(AuthenticatedUser::id).orElse(1L);
    }

    // Categoria B — strict (lança 401 se sem auth)
    public static Long currentUserId() {
        return getCurrentUser()
            .map(AuthenticatedUser::id)
            .orElseThrow(() -> new ApiException(401, "Não autenticado"));
    }

    public static void requireRole(List<String> allowedRoles) {
        AuthenticatedUser u = getCurrentUser()
            .orElseThrow(() -> new ApiException(401, "Não autenticado"));
        if (!allowedRoles.contains(u.role())) {
            throw new ApiException(403, "Acesso negado: permissão insuficiente");
        }
    }

    /** Para KRs: MANAGER só pode atualizar campo 'status'. */
    public static void requireKRUpdate(Map<String, Object> body) {
        AuthenticatedUser u = getCurrentUser()
            .orElseThrow(() -> new ApiException(401, "Não autenticado"));
        if ("ADMIN".equals(u.role())) return;
        if ("MANAGER".equals(u.role())) {
            if (body.size() == 1 && body.containsKey("status")) return;
            throw new ApiException(403, "Acesso negado: Gestores podem editar apenas o status dos KRs");
        }
        throw new ApiException(403, "Acesso negado: permissão insuficiente");
    }
}
```

---

## 8. Padrão: `Map<String, Object>` passthrough pra CRUDs simples

Em vez de criar entity + DTO pra cada tabela com 20 colunas, use:

```java
public List<Map<String, Object>> findAll() {
    return jdbc.queryForList(
        "SELECT * FROM areas WHERE is_deleted = FALSE ORDER BY ordem_linha, ordem_posicao"
    );
}
```

**Vantagens**:
- Reduz ~30 classes de entity desnecessárias
- JSON resultante já bate com Node (mesmas colunas, mesmos nomes snake_case)
- Menos código pra manter

**Custo**: menos type-safety no service — aceitável pra CRUDs simples (Areas, Pessoas, Ambientes, Colaboradores, etc.).

**Quando NÃO usar Map passthrough**:
- Serviços com lógica de negócio complexa (Processos de Negócio, TAP/TEP, Avaliações com cascade) — use entity ou record dedicado
- Quando precisa transformar campos antes de retornar

---

## 9. Padrão: `@Transactional` em mutations multi-tabela

```java
@Service
@RequiredArgsConstructor
public class PcaRenovacoesService {
    @Transactional
    public Map<String, Object> create(CreatePcaRenovacaoRequest req, Long userId) {
        Long renovacaoId = repo.insert(req, userId);
        repo.insertDetails(renovacaoId);
        repo.seedChecklist(renovacaoId);  // 6 inserts
        return repo.findById(renovacaoId);
    }
}
```

Espelha o `BEGIN/COMMIT` manual do Node. Se qualquer step falhar, rollback automático.

---

## 10. Padrão: ordenação por número extraído (PCA items)

```sql
SELECT * FROM pca_items
WHERE is_deleted = FALSE
ORDER BY
    CAST(NULLIF(regexp_replace(item_pca, '[^0-9]', '', 'g'), '') AS INTEGER) NULLS LAST,
    item_pca;
```

"PCA 100" vem depois de "PCA 50" (ordenação numérica, não lexicográfica).

---

## 11. Padrão: snapshot pattern (validarFinal + self-healing)

```java
@Transactional
public Map<String, Object> validarFinal(Long id, Long userId, String userName) {
    // 1. Atualizar processo + bumpar versão
    String novaVersao = bumpVersao(currentVersao, ciclos);
    repo.updateValidadoFinal(id, userId, userName, novaVersao);

    // 2. Snapshot em try/catch silencioso (não bloqueia homologação)
    try {
        repo.insertSnapshot(id, novaVersao, processoCompleto);
    } catch (Exception e) {
        log.warn("Falha ao gravar snapshot: {}", e.getMessage());
    }

    return repo.findById(id);
}

public List<Map<String, Object>> findVersoes(Long id) {
    var versoes = repo.findVersoes(id);
    // Self-healing: se status='validado_final' e versao_formulario > max(versao salva),
    // gera snapshot do estado corrente — recupera de falhas anteriores
    var processo = repo.findById(id);
    if ("validado_final".equals(processo.get("status"))) {
        String versaoAtual = (String) processo.get("versao");
        boolean hasCurrent = versoes.stream().anyMatch(v -> versaoAtual.equals(v.get("versao")));
        if (!hasCurrent) {
            try {
                repo.insertSnapshot(id, versaoAtual, processo);
                versoes = repo.findVersoes(id);  // re-read
            } catch (Exception e) {
                log.warn("Self-heal snapshot falhou: {}", e.getMessage());
            }
        }
    }
    return versoes;
}
```

---

## 12. Padrão: bump de versão condicional

```java
private String bumpVersao(String versaoAtual, int ciclos) {
    if (ciclos < 1) return versaoAtual;  // 1ª homologação mantém 1.0
    String[] partes = versaoAtual.split("\\.");
    int maior = Integer.parseInt(partes[0]);
    int menor = Integer.parseInt(partes[1]);
    return menor >= 9 ? (maior + 1) + ".0" : maior + "." + (menor + 1);
}
```

---

## 13. Padrão: `LinkedHashMap` pra query strings

```java
public static String buildQueryString(Object... kvPairs) {
    LinkedHashMap<String, String> params = new LinkedHashMap<>();
    for (int i = 0; i < kvPairs.length; i += 2) {
        params.put(kvPairs[i].toString(), String.valueOf(kvPairs[i+1]));
    }
    return params.entrySet().stream()
        .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
        .collect(Collectors.joining("&"));
}
```

Preserva ordem dos parâmetros (paridade com `URLSearchParams` JS).

---

## 14. Padrão: contract tests com RestAssured + JsonUnit

```java
public abstract class BaseContractTest {
    protected static final String NODE_URL = "http://localhost:8080";
    protected static final String JAVA_URL = "http://localhost:8081";

    protected static String bearerForUser(long userId) {
        String json = "{\"userId\":" + userId + "}";
        return "Bearer " + Base64.getEncoder().encodeToString(json.getBytes(UTF_8));
    }

    protected static final String[] VOLATILE_PATHS = {
        "$..created_at", "$..updated_at", "$..timestamp"
    };

    @BeforeAll
    static void verifyBackendsAlive() {
        try {
            given().get(NODE_URL + "/health").then().statusCode(200);
        } catch (Exception e) {
            throw new IllegalStateException(
                "Backend Node não está rodando em " + NODE_URL + ". Suba `npm run dev` na pasta kaizen-source/api/."
            );
        }
        try {
            given().get(JAVA_URL + "/health").then().statusCode(200);
        } catch (Exception e) {
            throw new IllegalStateException(
                "Backend Java não está rodando em " + JAVA_URL + "."
            );
        }
    }

    protected void assertSameJsonAndStatus(Response node, Response java, String... extraIgnoredPaths) {
        assertThat(java.statusCode())
            .as("Status code Java vs Node")
            .isEqualTo(node.statusCode());

        String[] allIgnored = ArrayUtils.addAll(VOLATILE_PATHS, extraIgnoredPaths);
        JsonUnitAssertions.assertThatJson(java.asString())
            .whenIgnoringPaths(allIgnored)
            .isEqualTo(node.asString());
    }

    protected Response[] callBoth(String method, String path, Long userId, Object body) {
        var requestNode = given();
        var requestJava = given();
        if (userId != null) {
            String auth = bearerForUser(userId);
            requestNode = requestNode.header("Authorization", auth);
            requestJava = requestJava.header("Authorization", auth);
        }
        if (body != null) {
            requestNode = requestNode.contentType(JSON).body(body);
            requestJava = requestJava.contentType(JSON).body(body);
        }
        Response nodeRes = requestNode.request(method, NODE_URL + path);
        Response javaRes = requestJava.request(method, JAVA_URL + path);
        return new Response[] { nodeRes, javaRes };
    }
}
```

Uso em test concreto:
```java
class HomeContractTest extends BaseContractTest {
    @Test void resumo_user4_superadmin_sgjt() {
        var responses = callBoth("GET", "/api/home/resumo", 4L, null);
        assertSameJsonAndStatus(responses[0], responses[1]);
    }
}
```

---

## 15. Disciplina operacional inegociável

Não é código, mas determina o sucesso do projeto:

1. **`git init` + remote + commit inicial ANTES do primeiro arquivo de código**
2. **Commit + push após cada sprint concluído** (idealmente após cada arquivo grande dentro do sprint)
3. **Smoke test no fim de cada sprint** antes de avançar pro próximo
4. **Paths absolutos em comandos destrutivos** (`rm -rf`, `mv`) — `cd` no Bash não persiste
5. **Validar `target/classes/.../*.class` após qualquer reorg** — `mvn BUILD SUCCESS` ≠ "Spring carregou"
6. **Bearer base64 só em smoke tests de dev** — produção sempre Keycloak JWT

---

## 16. Sequência de sprints (validada)

A ordem abaixo respeita as dependências e foi executada com sucesso na 1ª tentativa:

```
Sprint 0  →  Infra base
Sprint 1  →  Auth + Users
Sprint 2  →  Cadastros básicos (Areas, Pessoas, Permissoes, Ambientes, Colaboradores)
Sprint 3  →  OKR + Metas + Planos-Programas + Gestão Estratégica + Sprints
Sprint 4  →  Contratos & Projetos (TAP + TEP)
Sprint 5  →  PCA + Renovações
Sprint 6  →  Comitês + Forms
Sprint 7  →  Avaliações (cascade triplo)
Sprint 8  →  Processos de Negócio (validação 3 camadas)
Sprint 9  →  Home / Dashboard
Sprint 10 →  Contract tests Node × Java
Sprint 11 →  Hardening pré-cutover
```

**Não inverter ordem** — cada sprint depende de fundações dos anteriores.

---

## Fechamento

Esses 16 padrões são o esqueleto da migração. Com eles aplicados desde o Sprint 0, a 2ª tentativa avança muito mais rápido. Boa migração.
