package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.utils.OrgCodigos;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de processosNegocio.service.ts — validação identity-based em 3 camadas.
 * A autorização (autor / diretoria / superadmin) é feita no controller (igual ao Node, que
 * checa no route layer); o service só aplica as transições de status condicionadas.
 * Bump de versão SÓ em validarFinal e só quando ciclos_homologados >= 1 (1ª homologação fica em 1.0).
 * Snapshot em processos_negocio_historico após cada validarFinal (try/catch silencioso).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessosNegocioService {

    /** ~6MB — fluxograma (data URL base64). */
    private static final int FLUXOGRAMA_MAX_BYTES = 6_000_000;
    /** ~20MB — soma das bases64 dos documentos anexados. */
    private static final int DOCUMENTOS_TOTAL_MAX_BYTES = 20_000_000;
    /** ~6MB — PDF de aprovação (data URL base64). */
    private static final int APROVACAO_MAX_BYTES = 6_000_000;

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    /**
     * Listagem para o Escritório de Processos. A tela só precisa dos metadados (nome, status,
     * tipos de documentos anexados, se há fluxograma) — NUNCA dos bytes base64. Enviar o
     * fluxograma (~6MB) e os documentos (~20MB) de cada processo travava o carregamento da lista.
     * Por isso enxugamos o payload aqui: zeramos {@code fluxograma_data}, removemos o {@code data}
     * de cada documento (mantendo tipo/nome/mime) e expomos {@code tem_fluxograma}. O detalhe
     * (findById) continua retornando o processo completo para preview/download/PDF.
     */
    public List<Map<String, Object>> findAll(String diretoria) {
        return findAll(diretoria, null, false);
    }

    public List<Map<String, Object>> findAll(String diretoria, Long scopeUserId) {
        return findAll(diretoria, scopeUserId, false);
    }

    /**
     * Listagem com escopo por papel. Quando {@code scopeUserId == null} e {@code incluirVigentes}
     * é falso, retorna tudo (Gestor do Escritório, Compliance, SGJT). Senão restringe à UNIÃO de:
     *  - processos do usuário como Responsável (proprietarios), Editor (editores) ou Revisor
     *    (gestor da diretoria cadastrada), quando {@code scopeUserId != null};
     *  - processos "vigentes" (Modelo K1 = validado_final, ou com documento primário anexado),
     *    quando {@code incluirVigentes} (papel Visualizador).
     */
    public List<Map<String, Object>> findAll(String diretoria, Long scopeUserId, boolean incluirVigentes) {
        List<Object> params = new ArrayList<>();
        StringBuilder where = new StringBuilder("is_deleted = FALSE");
        if (diretoria != null) {
            params.add(diretoria);
            where.append(" AND diretoria = ?");
        }
        List<String> orClauses = new ArrayList<>();
        if (scopeUserId != null) {
            // Responsável: snapshot (responsavel_user_id) OU unidade do cadastro (por id ou nome).
            orClauses.add("EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(proprietarios, '[]'::jsonb)) e "
                    + "LEFT JOIN cadastros_unidades u ON ("
                    + "  ((e->>'unidade_id') ~ '^[0-9]+$' AND u.id = (e->>'unidade_id')::int) "
                    + "  OR LOWER(TRIM(u.nome)) = LOWER(TRIM(e->>'area'))) "
                    + "WHERE ((e->>'responsavel_user_id') ~ '^[0-9]+$' AND (e->>'responsavel_user_id')::int = ?) "
                    + "OR u.responsavel_user_id = ?)");
            params.add(scopeUserId);
            params.add(scopeUserId);
            orClauses.add("EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(editores, '[]'::jsonb)) e "
                    + "WHERE (e->>'user_id') ~ '^[0-9]+$' AND (e->>'user_id')::int = ?)");
            params.add(scopeUserId);
            orClauses.add("EXISTS (SELECT 1 FROM cadastros_areas a "
                    + "WHERE LOWER(TRIM(a.sigla)) = LOWER(TRIM(processos_negocio.diretoria)) "
                    + "AND a.gestor_user_id = ? AND COALESCE(a.ativo, TRUE) = TRUE)");
            params.add(scopeUserId);
        }
        if (incluirVigentes) {
            orClauses.add("(status = 'validado_final' OR EXISTS (SELECT 1 FROM "
                    + "jsonb_array_elements(COALESCE(documentos_anexados, '[]'::jsonb)) d WHERE d->>'tipo' = 'PRI'))");
        }
        if (!orClauses.isEmpty()) {
            where.append(" AND (").append(String.join(" OR ", orClauses)).append(")");
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM processos_negocio WHERE " + where + " ORDER BY updated_at DESC",
                params.toArray());
        for (Map<String, Object> row : rows) {
            stripHeavyFields(row);
        }
        return rows;
    }

    /** Remove os bytes base64 (fluxograma + documentos + aprovação) de uma linha da listagem, in-place. */
    private void stripHeavyFields(Map<String, Object> row) {
        Object fluxograma = row.get("fluxograma_data");
        boolean temFluxograma = fluxograma != null && !str(fluxograma).isBlank();
        row.put("fluxograma_data", null);

        // Coluna legada de aprovação única (migrations 163-165), não mais usada.
        row.put("aprovacao_data", null);

        // Aprovações por comitê: mantém metadados (comite/filename/mime/em), remove os bytes do PDF.
        List<Map<String, Object>> aprovacoes = parseAprovacoes(row.get("aprovacoes"));
        for (Map<String, Object> a : aprovacoes) {
            if (a != null) {
                a.remove("data");
            }
        }
        row.put("aprovacoes", aprovacoes);
        row.put("tem_aprovacao", !aprovacoes.isEmpty());

        List<Map<String, Object>> docs = stripDocumentosData(row.get("documentos_anexados"));
        row.put("documentos_anexados", docs);
        if (!temFluxograma) {
            temFluxograma = docs.stream()
                    .anyMatch(d -> "FLUXOGRAMA".equals(String.valueOf(d.get("tipo"))));
        }
        row.put("tem_fluxograma", temFluxograma);
    }

    /** Parseia o jsonb de documentos e descarta o campo {@code data} de cada item (mantém metadados). */
    private List<Map<String, Object>> stripDocumentosData(Object raw) {
        if (raw == null) {
            return new ArrayList<>();
        }
        String json = String.valueOf(raw);
        if (json.isBlank() || "null".equals(json)) {
            return new ArrayList<>();
        }
        try {
            List<Map<String, Object>> docs = objectMapper.readValue(json, new TypeReference<>() {});
            if (docs == null) {
                return new ArrayList<>();
            }
            for (Map<String, Object> d : docs) {
                if (d != null) {
                    d.remove("data");
                }
            }
            return docs;
        } catch (Exception e) {
            log.warn("[processosNegocio] falha ao enxugar documentos_anexados na listagem: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    public Map<String, Object> findById(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM processos_negocio WHERE id = ? AND is_deleted = FALSE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Retorna o processo apenas se ele passou por TODAS as camadas de validação (Responsável +
     * Revisor + Compliance Officer) e tem as atas de todos os comitês exigidos — a mesma condição
     * que faz o PDF exibir o código de validação. Usado na validação de autenticidade por código.
     * Retorna {@code null} se não existir ou não estiver plenamente validado.
     */
    public Map<String, Object> findByIdIfFinal(long id) {
        Map<String, Object> proc = findById(id);
        if (proc == null) {
            return null;
        }
        boolean todasValidacoes = proc.get("validado_autor_em") != null
                && proc.get("validado_diretoria_em") != null
                && proc.get("validado_final_em") != null;
        if (!todasValidacoes) {
            return null;
        }
        List<String> apreciacao = parseStringList(proc.get("apreciacao"));
        List<Map<String, Object>> aprovacoes = parseAprovacoes(proc.get("aprovacoes"));
        boolean atasOk = apreciacao.stream().allMatch(comite -> aprovacoes.stream()
                .anyMatch(a -> comite.equals(String.valueOf(a.get("comite")))));
        return atasOk ? proc : null;
    }

    /**
     * Bytes do PDF da ata de aprovação de um comitê, ou {@code null} se o processo não estiver
     * plenamente validado, o comitê não tiver ata ou os dados forem inválidos. Aceita tanto data
     * URL ({@code data:application/pdf;base64,...}) quanto base64 puro.
     */
    public byte[] getAtaPdf(long id, String comite) {
        if (comite == null) {
            return null;
        }
        Map<String, Object> proc = findByIdIfFinal(id);
        if (proc == null) {
            return null;
        }
        for (Map<String, Object> a : parseAprovacoes(proc.get("aprovacoes"))) {
            if (comite.equals(String.valueOf(a.get("comite"))) && a.get("data") != null) {
                String s = String.valueOf(a.get("data"));
                int comma = s.indexOf(',');
                if (s.startsWith("data:") && comma >= 0) {
                    s = s.substring(comma + 1);
                }
                try {
                    return java.util.Base64.getDecoder().decode(s);
                } catch (IllegalArgumentException e) {
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * Anexa/atualiza a aprovação de UM comitê (CGTIC/CGovTIC) na lista {@code aprovacoes}.
     * Cada comitê tem no máximo uma entrada (re-anexar substitui). Restrito a superadmin no controller.
     */
    public Map<String, Object> addAprovacao(long id, String comite, String data, String filename,
                                            String mime, String aprovacaoEm, long userId) {
        if (comite == null || comite.isBlank()) {
            throw new RuntimeException("COMITE_REQUIRED");
        }
        if (data == null || data.isBlank()) {
            throw new RuntimeException("APROVACAO_REQUIRED");
        }
        if (data.length() > APROVACAO_MAX_BYTES) {
            throw new RuntimeException("APROVACAO_TOO_LARGE");
        }
        Map<String, Object> proc = findById(id);
        if (proc == null) {
            return null;
        }
        List<Map<String, Object>> aprovacoes = parseAprovacoes(proc.get("aprovacoes"));
        aprovacoes.removeIf(a -> comite.equals(String.valueOf(a.get("comite"))));
        Map<String, Object> nova = new LinkedHashMap<>();
        nova.put("comite", comite);
        nova.put("filename", filename);
        nova.put("mime", mime);
        nova.put("data", data);
        nova.put("em", orNull(aprovacaoEm));
        aprovacoes.add(nova);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio SET aprovacoes = ?::jsonb, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING *",
                toJson(aprovacoes), userId, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> stamped = stampK1IfFirst(id);
        // A aprovação recém-anexada (e o ID/Data da Versão do K1 recém-carimbados) precisam entrar
        // no snapshot da versão vigente pra que o PDF do Histórico de Versões fique coerente.
        refreshSnapshotAtual(id);
        return stamped;
    }

    /** Remove a aprovação de um comitê específico da lista {@code aprovacoes}. */
    public Map<String, Object> removeAprovacao(long id, String comite, long userId) {
        Map<String, Object> proc = findById(id);
        if (proc == null) {
            return null;
        }
        List<Map<String, Object>> aprovacoes = parseAprovacoes(proc.get("aprovacoes"));
        aprovacoes.removeIf(a -> comite != null && comite.equals(String.valueOf(a.get("comite"))));
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio SET aprovacoes = ?::jsonb, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE RETURNING *",
                toJson(aprovacoes), userId, id);
        if (rows.isEmpty()) {
            return null;
        }
        // Mantém o snapshot da versão vigente coerente após remover uma aprovação de comitê.
        refreshSnapshotAtual(id);
        return findById(id);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseAprovacoes(Object raw) {
        if (raw == null) {
            return new ArrayList<>();
        }
        String json = String.valueOf(raw);
        if (json.isBlank() || "null".equals(json)) {
            return new ArrayList<>();
        }
        try {
            List<Map<String, Object>> list = objectMapper.readValue(json, new TypeReference<>() {});
            return list == null ? new ArrayList<>() : list;
        } catch (Exception e) {
            log.warn("[processosNegocio] falha ao parsear aprovacoes: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private List<String> parseStringList(Object raw) {
        if (raw == null) {
            return new ArrayList<>();
        }
        String json = String.valueOf(raw);
        if (json.isBlank() || "null".equals(json)) {
            return new ArrayList<>();
        }
        try {
            List<String> list = objectMapper.readValue(json, new TypeReference<>() {});
            return list == null ? new ArrayList<>() : list;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    /**
     * É Modelo K1 (visão do backend): validado_final + todos os comitês da apreciação aprovados.
     * Os campos obrigatórios já são garantidos pela trava de envio à validação.
     */
    private boolean isK1Server(Map<String, Object> proc) {
        if (!"validado_final".equals(String.valueOf(proc.get("status")))) {
            return false;
        }
        List<String> apreciacao = parseStringList(proc.get("apreciacao"));
        List<Map<String, Object>> aprovacoes = parseAprovacoes(proc.get("aprovacoes"));
        for (String comite : apreciacao) {
            boolean ok = aprovacoes.stream()
                    .anyMatch(a -> comite.equals(String.valueOf(a.get("comite"))));
            if (!ok) {
                return false;
            }
        }
        return true;
    }

    /**
     * Ao gerar o PRIMEIRO Modelo K1: carimba periodo (Data da Versão) e k1_gerado_em com a data de
     * hoje E gera o ID do processo (PN_{macroArea}_{diretoria}_{seq}, sequencial global por ordem
     * de geração). Idempotente: só na 1ª vez. Retorna a linha (atualizada ou não).
     */
    private Map<String, Object> stampK1IfFirst(long id) {
        Map<String, Object> proc = findById(id);
        if (proc == null) {
            return null;
        }
        if (proc.get("k1_gerado_em") == null && isK1Server(proc)) {
            String codigo = gerarCodigoProcesso(str(proc.get("diretoria")));
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "UPDATE processos_negocio SET periodo = CURRENT_DATE, k1_gerado_em = CURRENT_DATE, " +
                            "codigo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = FALSE RETURNING *",
                    codigo, id);
            if (!rows.isEmpty()) {
                return rows.get(0);
            }
        }
        return proc;
    }

    /** Gera o ID do processo: PN_{macroArea}_{diretoria}_{seq3}. Sequencial global (ordem de geração). */
    private String gerarCodigoProcesso(String diretoriaSigla) {
        Integer nextSeq = jdbc.queryForObject(
                "SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM '_(\\d+)$') AS INTEGER)), 0) + 1 " +
                        "FROM processos_negocio WHERE codigo IS NOT NULL",
                Integer.class);
        int seq = nextSeq == null ? 1 : nextSeq;
        return "PN_" + OrgCodigos.MACRO_AREA + "_" + OrgCodigos.diretoria(diretoriaSigla)
                + "_" + String.format("%03d", seq);
    }

    public Map<String, Object> create(Map<String, Object> data, long userId) {
        String fluxograma = str(data.get("fluxograma_data"));
        if (fluxograma != null && fluxograma.length() > FLUXOGRAMA_MAX_BYTES) {
            throw new RuntimeException("FLUXOGRAMA_TOO_LARGE");
        }
        if (calcDocsTotalBytes(data.get("documentos_anexados")) > DOCUMENTOS_TOTAL_MAX_BYTES) {
            throw new RuntimeException("DOCUMENTOS_TOO_LARGE");
        }
        // Versão inicial: manual quando há documento primário anexado (pode já estar na 9ª, etc.);
        // senão começa em "1" e é gerida automaticamente pelo ciclo de homologação.
        String versaoInicial = str(data.get("versao"));
        if (versaoInicial == null || versaoInicial.isBlank()) {
            versaoInicial = "1";
        }
        return jdbc.queryForMap(
                "INSERT INTO processos_negocio ( " +
                        "  macroprocesso, diretoria, periodo, revisao, codigo_versao, nome_processo, " +
                        "  descricao, detalhamento, " +
                        "  proprietarios, atores, areas_responsaveis, " +
                        "  entradas, saidas, " +
                        "  sistemas_ferramentas, normativos_referencias, " +
                        "  fluxograma_data, fluxograma_filename, fluxograma_mime, " +
                        "  documentos_anexados, apreciacao, " +
                        "  periodicidade_revisao, " +
                        "  numero_proad, observacoes_gerais, indicadores, versao, " +
                        "  status, created_by, updated_by " +
                        ") VALUES ( " +
                        "  ?, ?, ?, ?, ?, ?, " +
                        "  ?, ?, " +
                        "  ?::jsonb, ?::jsonb, ?::jsonb, " +
                        "  ?::jsonb, ?::jsonb, " +
                        "  ?::jsonb, ?::jsonb, " +
                        "  ?, ?, ?, " +
                        "  ?::jsonb, ?::jsonb, " +
                        "  ?, " +
                        "  ?, ?, ?, ?, " +
                        "  'em_elaboracao', ?, ? " +
                        ") RETURNING *",
                str(data.get("macroprocesso")), str(data.get("diretoria")), orNull(data.get("periodo")),
                orNull(data.get("revisao")), orNull(data.get("codigo_versao")), str(data.get("nome_processo")),
                orNull(data.get("descricao")), orNull(data.get("detalhamento")),
                toJsonArray(data.get("proprietarios")), toJsonArray(data.get("atores")), toJsonArray(data.get("areas_responsaveis")),
                toJsonArray(data.get("entradas")), toJsonArray(data.get("saidas")),
                toJsonArray(data.get("sistemas_ferramentas")), toJsonArray(data.get("normativos_referencias")),
                orNull(data.get("fluxograma_data")), orNull(data.get("fluxograma_filename")), orNull(data.get("fluxograma_mime")),
                toJsonArray(data.get("documentos_anexados")), toJsonArray(data.get("apreciacao")),
                orNull(data.get("periodicidade_revisao")),
                orNull(data.get("numero_proad")), orNull(data.get("observacoes_gerais")), orNull(data.get("indicadores")), versaoInicial,
                userId, userId);
    }

    public Map<String, Object> update(long id, Map<String, Object> data, long userId,
                                      boolean concluiEdicaoAoSalvar, String userName) {
        String fluxograma = str(data.get("fluxograma_data"));
        if (fluxograma != null && fluxograma.length() > FLUXOGRAMA_MAX_BYTES) {
            throw new RuntimeException("FLUXOGRAMA_TOO_LARGE");
        }
        if (data.containsKey("documentos_anexados") && calcDocsTotalBytes(data.get("documentos_anexados")) > DOCUMENTOS_TOTAL_MAX_BYTES) {
            throw new RuntimeException("DOCUMENTOS_TOO_LARGE");
        }

        List<String> fields = new ArrayList<>();
        List<Object> values = new ArrayList<>();

        pushScalar(data, fields, values, "macroprocesso");
        pushScalar(data, fields, values, "diretoria");
        pushScalar(data, fields, values, "periodo");
        pushScalar(data, fields, values, "revisao");
        pushScalar(data, fields, values, "codigo_versao");
        pushScalar(data, fields, values, "nome_processo");
        pushScalar(data, fields, values, "descricao");
        pushScalar(data, fields, values, "detalhamento");
        pushScalar(data, fields, values, "indicadores");
        pushJson(data, fields, values, "proprietarios");
        pushJson(data, fields, values, "atores");
        pushJson(data, fields, values, "areas_responsaveis");
        pushJson(data, fields, values, "entradas");
        pushJson(data, fields, values, "saidas");
        pushJson(data, fields, values, "sistemas_ferramentas");
        pushJson(data, fields, values, "normativos_referencias");
        pushScalar(data, fields, values, "fluxograma_data");
        pushScalar(data, fields, values, "fluxograma_filename");
        pushScalar(data, fields, values, "fluxograma_mime");
        pushJson(data, fields, values, "documentos_anexados");
        pushJson(data, fields, values, "apreciacao");
        pushScalar(data, fields, values, "periodicidade_revisao");
        pushScalar(data, fields, values, "numero_proad");
        pushScalar(data, fields, values, "observacoes_gerais");
        // Só atualiza a versão quando o front envia o campo (processos com documento primário).
        // Sem a chave, a versão gerida pelo ciclo de homologação é preservada.
        pushScalar(data, fields, values, "versao");

        // Editar um processo VIGENTE (validado_final) invalida a homologação: volta o status para
        // 'em_elaboracao' e limpa as marcas de validação/recusa (mesmo efeito do iniciarRevisao).
        // A versão volta a incrementar quando o processo for re-homologado (validarFinal). Demais
        // status ficam intactos — preserva a correção in-layer do Revisor (validado_autor) e do
        // Compliance (validado_diretoria), que validam a própria camada sem devolver ao autor.
        List<Map<String, Object>> atual = jdbc.queryForList(
                "SELECT status FROM processos_negocio WHERE id = ? AND is_deleted = FALSE", id);
        String statusAtual = atual.isEmpty() ? null : str(atual.get(0).get("status"));
        // Editar um processo VIGENTE (validado_final) reabre o ciclo: volta o status para
        // 'em_elaboracao' (precisa revalidar). NÃO limpa os carimbos das camadas — o processo já é
        // Modelo K1 e o PDF/tela continuam mostrando a ÚLTIMA validação até a revalidação
        // sobrescrever (evita um K1 aparecer "Pendente"). O ciclo é re-carimbado ao reenviar/validar.
        boolean reabrirCiclo = "validado_final".equals(statusAtual);
        if (reabrirCiclo) {
            fields.add("status = 'em_elaboracao'");
            fields.add("recusado_em = NULL");
            fields.add("recusado_por_user_id = NULL");
            fields.add("recusado_por_nome = NULL");
            fields.add("recusado_camada = NULL");
            fields.add("recusa_motivo = NULL");
        }

        // "Edição concluída" é STICKY: uma vez marcada, nunca mais volta a pendente. O lembrete
        // "Aguardando o editor" só aparece ANTES da 1ª conclusão. Marca quando salva:
        //  - Responsável / Gestor / Revisor / Compliance (concluiEdicaoAoSalvar): a própria edição
        //    conclui (editam, salvam e validam direto).
        //  - Editor atribuído (só editor): NÃO marca aqui — ele preenche dia a dia e conclui pelo
        //    botão "Concluir edição". Como é sticky, não zeramos em edição nenhuma.
        if ((reabrirCiclo || "em_elaboracao".equals(statusAtual) || "recusado".equals(statusAtual))
                && concluiEdicaoAoSalvar) {
            fields.add("edicao_concluida_em = CURRENT_TIMESTAMP");
            fields.add("edicao_concluida_por_user_id = ?");
            values.add(userId);
            fields.add("edicao_concluida_por_nome = ?");
            values.add(userName);
        }

        if (fields.isEmpty()) {
            return findById(id);
        }
        fields.add("updated_at = CURRENT_TIMESTAMP");
        values.add(userId);
        fields.add("updated_by = ?");
        values.add(id);

        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio SET " + String.join(", ", fields) +
                        " WHERE id = ? AND is_deleted = FALSE RETURNING *",
                values.toArray());
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Enviar para validação. O fluxo de aprovação tem 2 camadas (Setorial → Estratégica):
     * a camada do responsável é carimbada automaticamente no envio (quem envia é o
     * responsável), e o processo já segue para "validado_autor" (= aguardando a diretoria).
     */
    public Map<String, Object> enviarParaValidacao(long id, long userId, String userName) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio " +
                        "SET status = 'validado_autor', updated_at = CURRENT_TIMESTAMP, updated_by = ?, " +
                        "    recusado_em = NULL, recusado_por_user_id = NULL, recusado_por_nome = NULL, " +
                        "    recusado_camada = NULL, recusa_motivo = NULL, " +
                        "    validado_autor_user_id = ?, validado_autor_nome = ?, validado_autor_em = CURRENT_TIMESTAMP, " +
                        "    validado_diretoria_user_id = NULL, validado_diretoria_nome = NULL, validado_diretoria_em = NULL, " +
                        "    validado_final_user_id = NULL, validado_final_nome = NULL, validado_final_em = NULL " +
                        "WHERE id = ? AND is_deleted = FALSE AND status IN ('em_elaboracao', 'recusado', 'validado_final') " +
                        "RETURNING *",
                userId, userId, userName, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Inicia uma revisão antecipada de um processo vigente (Modelo K1): volta o status para
     * 'em_elaboracao' para que o responsável possa editar e reenviar antes do prazo. Limpa as
     * marcas de validação/recusa para reiniciar o ciclo de forma limpa; o histórico de versões
     * permanece intacto. Só atua sobre processos em 'validado_final'.
     */
    public Map<String, Object> iniciarRevisao(long id, long userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio " +
                        "SET status = 'em_elaboracao', updated_at = CURRENT_TIMESTAMP, updated_by = ?, " +
                        "    recusado_em = NULL, recusado_por_user_id = NULL, recusado_por_nome = NULL, " +
                        "    recusado_camada = NULL, recusa_motivo = NULL " +
                        "WHERE id = ? AND is_deleted = FALSE AND status = 'validado_final' " +
                        "RETURNING *",
                userId, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Editor atribuído sinaliza que terminou a versão completa do processo ("Concluir edição").
     * Só a partir daqui o Responsável pode validar a camada 1. Enquanto pendente
     * (edicao_concluida_em nulo), o Responsável fica bloqueado. Só atua em em_elaboracao/recusado;
     * qualquer edição de conteúdo posterior zera o sinal (ver update()).
     */
    public Map<String, Object> concluirEdicao(long id, long userId, String userName) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio " +
                        "SET edicao_concluida_em = CURRENT_TIMESTAMP, edicao_concluida_por_user_id = ?, " +
                        "    edicao_concluida_por_nome = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE AND status IN ('em_elaboracao', 'recusado') " +
                        "RETURNING *",
                userId, userName, userId, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Atribui um editor (usuário com permissão de editar/salvar o conteúdo do processo). Idempotente:
     * não duplica se o usuário já for editor. Retorna null se o usuário-editor não existir.
     */
    public Map<String, Object> addEditor(long id, long editorUserId, long byUserId) {
        var urows = jdbc.queryForList(
                "SELECT name, email FROM users WHERE id = ? AND is_deleted = FALSE", editorUserId);
        if (urows.isEmpty()) {
            return null;
        }
        Map<String, Object> u = urows.get(0);
        Map<String, Object> editor = new java.util.LinkedHashMap<>();
        editor.put("user_id", editorUserId);
        editor.put("nome", u.get("name"));
        editor.put("email", u.get("email"));
        jdbc.update(
                "UPDATE processos_negocio " +
                        "SET editores = COALESCE(editores, '[]'::jsonb) || ?::jsonb, " +
                        "    updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE " +
                        "AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(editores, '[]'::jsonb)) e " +
                        "  WHERE (e->>'user_id') ~ '^[0-9]+$' AND (e->>'user_id')::int = ?)",
                toJson(editor), byUserId, id, editorUserId);
        return findById(id);
    }

    /** Remove um editor do processo. */
    public Map<String, Object> removeEditor(long id, long editorUserId, long byUserId) {
        jdbc.update(
                "UPDATE processos_negocio " +
                        "SET editores = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(COALESCE(editores, '[]'::jsonb)) e " +
                        "  WHERE NOT ((e->>'user_id') ~ '^[0-9]+$' AND (e->>'user_id')::int = ?)), '[]'::jsonb), " +
                        "  updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE",
                editorUserId, byUserId, id);
        return findById(id);
    }

    public Map<String, Object> validarAutor(long id, long userId, String userName) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio " +
                        "SET status = 'validado_autor', validado_autor_user_id = ?, validado_autor_nome = ?, " +
                        "    validado_autor_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE AND status = 'enviado' " +
                        "RETURNING *",
                userId, userName, userId, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> validarDiretoria(long id, long userId, String userName) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio " +
                        "SET status = 'validado_diretoria', validado_diretoria_user_id = ?, validado_diretoria_nome = ?, " +
                        "    validado_diretoria_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE AND status = 'validado_autor' " +
                        "RETURNING *",
                userId, userName, userId, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    public Map<String, Object> validarFinal(long id, long userId, String userName) {
        List<Map<String, Object>> current = jdbc.queryForList(
                "SELECT versao, ciclos_homologados FROM processos_negocio " +
                        "WHERE id = ? AND is_deleted = FALSE AND status = 'validado_diretoria'", id);
        if (current.isEmpty()) {
            return null;
        }
        String versaoAtual = current.get(0).get("versao") != null ? str(current.get(0).get("versao")) : "1";
        int ciclos = current.get(0).get("ciclos_homologados") != null
                ? ((Number) current.get(0).get("ciclos_homologados")).intValue() : 0;

        // A versão é um inteiro e incrementa de 1 em 1 a cada nova homologação (1 → 2 → ... → 9 → 10).
        // O parse do split aceita versões legadas no formato "1.0" (usa apenas a parte inteira).
        String novaVersao = versaoAtual;
        if (ciclos >= 1) {
            int atual = parseIntSafe(versaoAtual.split("\\.")[0], 1);
            novaVersao = String.valueOf(atual + 1);
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio " +
                        "SET status = 'validado_final', validado_final_user_id = ?, validado_final_nome = ?, " +
                        "    validado_final_em = CURRENT_TIMESTAMP, versao = ?, " +
                        "    ciclos_homologados = ciclos_homologados + 1, " +
                        "    updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE AND status = 'validado_diretoria' " +
                        "RETURNING *",
                userId, userName, novaVersao, userId, id);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> processo = rows.get(0);

        // Carimba o 1º Modelo K1 (codigo/periodo/k1_gerado_em) ANTES de congelar o snapshot, pra
        // que a versão histórica já contenha o ID e a Data da Versão quando o K1 é imediato
        // (processos sem apreciação de comitê). Para processos que dependem de aprovação de comitê,
        // o snapshot é atualizado depois, ao anexar a aprovação (refreshSnapshotAtual).
        Map<String, Object> homologado = stampK1IfFirst(id);
        Map<String, Object> snapshotRow = homologado != null ? homologado : processo;

        // Snapshot da versão no histórico (falha silenciosa pra não bloquear a homologação)
        try {
            jdbc.update(
                    "INSERT INTO processos_negocio_historico " +
                            "  (processo_id, versao, snapshot, validado_final_em, validado_final_nome, validado_final_user_id) " +
                            "VALUES (?, ?, ?::jsonb, ?, ?, ?)",
                    id, novaVersao, toJson(snapshotRow), snapshotRow.get("validado_final_em"), userName, userId);
        } catch (Exception err) {
            log.warn("[processosNegocio] falha ao gravar snapshot histórico: {}", err.getMessage());
        }

        return homologado != null ? homologado : processo;
    }

    public List<Map<String, Object>> listVersoes(long id) {
        return jdbc.queryForList(
                "SELECT id, versao, validado_final_em, validado_final_nome, created_at " +
                        "FROM processos_negocio_historico WHERE processo_id = ? ORDER BY created_at DESC",
                id);
    }

    public Object getVersaoSnapshot(long processoId, long historicoId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT snapshot FROM processos_negocio_historico WHERE id = ? AND processo_id = ?",
                historicoId, processoId);
        if (rows.isEmpty()) {
            return null;
        }
        return rows.get(0).get("snapshot");
    }

    /**
     * Atualiza o snapshot da versão MAIS RECENTE do processo para refletir o estado homologado
     * atual. Usado quando o documento vigente é finalizado APÓS a homologação — ao carimbar o
     * ID/Data da Versão do 1º K1 ou ao anexar/remover a aprovação de um comitê — mantendo o
     * "Histórico de Versões" (e o PDF de cada versão) coerente com o Modelo K1 vigente.
     * No-op quando o processo ainda não tem nenhuma versão homologada.
     */
    private void refreshSnapshotAtual(long processoId) {
        try {
            Map<String, Object> live = findById(processoId);
            if (live == null) {
                return;
            }
            // Só sincroniza a versão vigente quando o processo está homologado. Se foi reaberto
            // (em_elaboracao) não se deve sobrescrever o snapshot congelado da última versão.
            if (!"validado_final".equals(String.valueOf(live.get("status")))) {
                return;
            }
            jdbc.update(
                    "UPDATE processos_negocio_historico SET snapshot = ?::jsonb " +
                            "WHERE id = (SELECT id FROM processos_negocio_historico WHERE processo_id = ? " +
                            "ORDER BY created_at DESC, id DESC LIMIT 1)",
                    toJson(live), processoId);
        } catch (Exception e) {
            log.warn("[processosNegocio] falha ao atualizar snapshot da versão atual: {}", e.getMessage());
        }
    }

    public Map<String, Object> recusar(long id, long userId, String userName, String camada, String motivo) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "UPDATE processos_negocio " +
                        "SET status = 'recusado', recusado_em = CURRENT_TIMESTAMP, recusado_por_user_id = ?, " +
                        "    recusado_por_nome = ?, recusado_camada = ?, recusa_motivo = ?, " +
                        "    updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE " +
                        "RETURNING *",
                userId, userName, camada, motivo, userId, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public boolean delete(long id, long userId) {
        int rc = jdbc.update(
                "UPDATE processos_negocio " +
                        "SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE",
                userId, id);
        return rc > 0;
    }

    // ============================================================
    // Helpers
    // ============================================================

    private void pushScalar(Map<String, Object> data, List<String> fields, List<Object> values, String col) {
        if (data.containsKey(col)) {
            fields.add(col + " = ?");
            values.add(data.get(col));
        }
    }

    private void pushJson(Map<String, Object> data, List<String> fields, List<Object> values, String col) {
        if (data.containsKey(col)) {
            fields.add(col + " = ?::jsonb");
            values.add(toJson(data.get(col)));
        }
    }

    @SuppressWarnings("unchecked")
    private static long calcDocsTotalBytes(Object docs) {
        if (!(docs instanceof List<?> list) || list.isEmpty()) {
            return 0;
        }
        long sum = 0;
        for (Object o : list) {
            if (o instanceof Map<?, ?> m) {
                Object d = ((Map<String, Object>) m).get("data");
                if (d != null) {
                    sum += String.valueOf(d).length();
                }
            }
        }
        return sum;
    }

    /** Serializa um array de strings; null/ausente vira "[]" (paridade com JSON.stringify(x || [])). */
    private String toJsonArray(Object value) {
        if (value == null) {
            return "[]";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "null";
        }
    }

    private static int parseIntSafe(String s, int fallback) {
        if (s == null) {
            return fallback;
        }
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static Object orNull(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof String s && s.isEmpty()) {
            return null;
        }
        return v;
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
