package br.jus.tjgo.kaizen.config;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.postgresql.util.PGobject;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.io.IOException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Serializers customizados para paridade byte-a-byte com o backend Node.
 * Cobre os bugs conhecidos da 1a tentativa: #2 (java.sql.Date), #3 (PGobject/JSONB),
 * #5 (java.sql.Array). Ordem de registro importa: java.sql.Date ANTES de java.util.Date.
 */
@Configuration
public class JacksonConfig {

    private static final DateTimeFormatter ISO_WITH_MILLIS = DateTimeFormatter
            .ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
            .withZone(ZoneOffset.UTC);

    // Fuso da aplicação (Brasil, -03:00). Colunas `date` são renderizadas como meia-noite LOCAL,
    // igual ao driver pg do Node, que devolve dates com TZ local (ex: 2026-02-02 -> ...T03:00:00.000Z).
    private static final ZoneId APP_ZONE = ZoneId.of("America/Sao_Paulo");

    // Parser/serializador compacto para reescrever JSONB do Postgres (que vem com espaços) sem
    // espaços, igual ao Node (pg parseia o jsonb e res.json re-emite compacto). Preserva ordem das chaves.
    private static final ObjectMapper JSONB_COMPACT = new ObjectMapper();

    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        SimpleModule module = new SimpleModule();

        // Instant / OffsetDateTime -> ISO com .SSSZ (paridade Node Date.toISOString())
        module.addSerializer(Instant.class, new JsonSerializer<Instant>() {
            @Override
            public void serialize(Instant value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                gen.writeString(ISO_WITH_MILLIS.format(value));
            }
        });
        module.addSerializer(OffsetDateTime.class, new JsonSerializer<OffsetDateTime>() {
            @Override
            public void serialize(OffsetDateTime value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                gen.writeString(ISO_WITH_MILLIS.format(value.toInstant()));
            }
        });

        // java.sql.Date -> ISO em meia-noite LOCAL (America/Sao_Paulo) — paridade com o pg/Node
        // (registrar ANTES de java.util.Date). Ex: date 2026-02-02 -> "2026-02-02T03:00:00.000Z".
        module.addSerializer(java.sql.Date.class, new JsonSerializer<java.sql.Date>() {
            @Override
            public void serialize(java.sql.Date value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                Instant instant = value.toLocalDate().atStartOfDay(APP_ZONE).toInstant();
                gen.writeString(ISO_WITH_MILLIS.format(instant));
            }
        });

        // java.util.Date / java.sql.Timestamp -> ISO
        module.addSerializer(java.util.Date.class, new JsonSerializer<java.util.Date>() {
            @Override
            public void serialize(java.util.Date value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                gen.writeString(ISO_WITH_MILLIS.format(value.toInstant()));
            }
        });

        // java.sql.Array -> JSON array nativo — Bug #5 (caminho organograma, *_vinculadas_ids)
        module.addSerializer(java.sql.Array.class, new JsonSerializer<java.sql.Array>() {
            @Override
            public void serialize(java.sql.Array value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                try {
                    Object[] elements = (Object[]) value.getArray();
                    gen.writeStartArray();
                    for (Object e : elements) {
                        gen.writeObject(e);
                    }
                    gen.writeEndArray();
                } catch (java.sql.SQLException ex) {
                    throw new IOException("Falha ao serializar java.sql.Array", ex);
                }
            }
        });

        // BigDecimal (colunas numeric/decimal) -> STRING, paridade com o driver pg do Node,
        // que serializa numeric como string ("1000.00") para preservar precisao. Aplica-se a
        // passthrough de linhas (valor_estimado, valor_anual, valor_estimado_contratacao, etc.).
        // Stats que o Node converte via parseFloat/parseInt sao montados como Double/Integer no
        // service e NAO passam por aqui.
        module.addSerializer(java.math.BigDecimal.class, new JsonSerializer<java.math.BigDecimal>() {
            @Override
            public void serialize(java.math.BigDecimal value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                gen.writeString(value.toPlainString());
            }
        });

        // Double -> formato JS Number.toString (decimal plano, sem notação científica; inteiros sem ".0").
        // Paridade com o JSON.stringify do Node, que nunca usa cientifico nessa faixa (ex: SUM numeric
        // parseado p/ número vira 153481760.94, nao 1.5348176094E8). Valores integrais saem sem ".0" (100, nao 100.0).
        module.addSerializer(Double.class, new JsonSerializer<Double>() {
            @Override
            public void serialize(Double value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                double d = value;
                if (Double.isNaN(d) || Double.isInfinite(d)) {
                    gen.writeNumber(d);
                } else if (d == Math.rint(d) && Math.abs(d) < 1e15) {
                    gen.writeNumber(Long.toString((long) d));
                } else {
                    gen.writeNumber(new java.math.BigDecimal(Double.toString(d)).toPlainString());
                }
            }
        });

        // Long / BigInteger (colunas int8/bigint e COUNT(*)) -> STRING, paridade com o driver pg do Node,
        // que serializa int8 como string ("13") enquanto int4 vai como número. O JdbcTemplate mapeia
        // int8/COUNT -> Long e int4 -> Integer; logo só Long/BigInteger viram string (Integer fica número).
        // Isso replica total_respostas/total_projetos/total_competencias etc. como string, fiel ao Node.
        module.addSerializer(Long.class, new JsonSerializer<Long>() {
            @Override
            public void serialize(Long value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                gen.writeString(value.toString());
            }
        });
        module.addSerializer(java.math.BigInteger.class, new JsonSerializer<java.math.BigInteger>() {
            @Override
            public void serialize(java.math.BigInteger value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                gen.writeString(value.toString());
            }
        });

        // PGobject (JSONB) -> JSON compacto — Bug #3 + fix A (Sprint 11).
        // O texto jsonb do Postgres vem com espaços (`{"id": 1, "nome": ...}`); o Node parseia e
        // re-emite compacto via res.json. Aqui parseamos e re-emitimos compacto (preservando a ordem
        // das chaves), casando byte-a-byte com o Node. Fallback p/ raw se não for JSON parseável.
        module.addSerializer(PGobject.class, new JsonSerializer<PGobject>() {
            @Override
            public void serialize(PGobject value, JsonGenerator gen, SerializerProvider sp) throws IOException {
                String json = value.getValue();
                if (json == null || json.isEmpty()) {
                    gen.writeNull();
                    return;
                }
                try {
                    gen.writeRawValue(JSONB_COMPACT.writeValueAsString(JSONB_COMPACT.readTree(json)));
                } catch (Exception e) {
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
