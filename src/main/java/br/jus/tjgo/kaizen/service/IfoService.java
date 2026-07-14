package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.dto.AtualizarIfoRequest;
import br.jus.tjgo.kaizen.dto.CriarIfoRequest;
import br.jus.tjgo.kaizen.dto.IfoDto;
import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * IFO (Item de Formação do Orçamento) — cria e consulta as bandas-envelope da Formação. O código
 * IFO-{ano}-{NNNN} é gerado sequencialmente por ano (RF-49). O IFO agrupa 1:N contratos continuada
 * da DFD-Consulta (RF-10/11) e é enviado à CCA (RF-24/26). Na publicação vira código oficial de PCA.
 */
@Service
@RequiredArgsConstructor
public class IfoService {

    private final JdbcTemplate jdbc;
    private final OrcamentoPapelService papelService;
    private final PermissoesAcoesService permissoesAcoesService;

    // Domínios validados aqui no backend — os CHECK foram removidos do banco (migration 172).
    private static final List<String> BLOCOS =
            List.of("encerramento", "renovacao", "plurianual", "nova_contratacao");

    private static final List<String> NATUREZAS = List.of("continuada", "pontual");

    private static final Map<String, List<String>> TAGS_ACESSO_POR_ESTADO = Map.ofEntries(
        Map.entry("aguardando_proad", List.of("PCA_FORMACAO_ABERTURA", "PCA_REGISTRAR_PROAD", "PCA_ENCAMINHAR_CONSULTA")),
        Map.entry("aberto_aguardando_proad", List.of("PCA_FORMACAO_ABERTURA", "PCA_REGISTRAR_PROAD", "PCA_ENCAMINHAR_CONSULTA")),
        Map.entry("aberto", List.of("PCA_FORMACAO_ABERTURA", "PCA_REGISTRAR_PROAD", "PCA_ENCAMINHAR_CONSULTA")),
        Map.entry("em_consulta_1", List.of("PCA_VALIDAR_DEMANDA_1_CAMADA", "PCA_VALIDAR_DEMANDA_2_CAMADA", "PCA_REMETER_PARTICAO")),
        Map.entry("em_consulta_2", List.of("PCA_VALIDAR_DEMANDA_1_CAMADA", "PCA_VALIDAR_DEMANDA_2_CAMADA", "PCA_REMETER_PARTICAO")),
        Map.entry("consolidacao_cca", List.of("PCA_CONSOLIDAR_ENCAMINHAR_GEJUT")),
        Map.entry("validacao_gejut", List.of("PCA_ENCAMINHAR_SGJT")),
        Map.entry("apreciacao_sgjt", List.of("PCA_PAUTAR_COMITES")),
        Map.entry("em_comites", List.of("PCA_AUTORIZAR_COMITES")),
        Map.entry("remessa_dg", List.of("PCA_REMETER_DG")),
        Map.entry("publicado", List.of()) // sem restrição
    );

    public String gerarCodigo(int ano) {
        Integer proximo = jdbc.queryForObject(
                "SELECT COALESCE(MAX(CAST(SPLIT_PART(codigo, '-', 3) AS INTEGER)), 0) + 1 FROM ifo WHERE ano = ?",
                Integer.class, ano);
        return String.format("IFO-%d-%04d", ano, proximo == null ? 1 : proximo);
    }

    @Transactional
    public IfoDto criar(CriarIfoRequest req, Long userId) {
        if (req.ano() == null) {
            throw new ApiException(400, "Ano é obrigatório");
        }
        if (req.bloco() == null || !BLOCOS.contains(req.bloco())) {
            throw new ApiException(400, "Bloco inválido");
        }
        if (req.natureza() != null && !NATUREZAS.contains(req.natureza())) {
            throw new ApiException(400, "Natureza inválida");
        }
        String codigo = gerarCodigo(req.ano());
        Long cents = req.valorEstimado() == null ? null : Math.round(req.valorEstimado() * 100);

        var rows = jdbc.queryForList(
                "INSERT INTO ifo (codigo, ano, ciclo_id, bloco, natureza, objeto, area_demandante, " +
                        "unidade_id, area_id, estado, valor_estimado_cents, interesse_renovacao, " +
                        "description, justification, process, financial_resource_type, contract_type, " +
                        "formalized_value_cents, id_cadastros_areas, priority, estimated_date, " +
                        "created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                codigo, req.ano(), req.cicloId(), req.bloco(), req.natureza(), req.objeto(),
                req.areaDemandante(), req.unidadeId(), req.areaId(), cents, req.interesseRenovacao(),
                req.description(), req.justification(), req.process(), req.financialResourceType(), req.contractType(),
                req.formalizedValueCents(), req.idCadastrosAreas(), req.priority(), req.estimatedDate(),
                userId, userId);

        Long ifoId = asLong(rows.get(0).get("id"));
        vincularContratos(ifoId, req.contratos());
        return get(ifoId);
    }

    private void verificarPermissaoEdicao(long ifoId, String prefixoAcao, Long userId) {
        if (userId == null) throw new ApiException(403, "Usuário não identificado");
        var info = jdbc.queryForList(
            "SELECT i.estado as ifo_estado, c.estado as ciclo_estado, c.finalidade " +
            "FROM ifo i " +
            "JOIN ciclo_orcamentario c ON i.ciclo_id = c.id " +
            "WHERE i.id = ?", ifoId);
        
        if (info.isEmpty()) throw new ApiException(404, "IFO não encontrado");
        
        String ifoEstado = (String) info.get(0).get("ifo_estado");
        String cicloEstado = (String) info.get(0).get("ciclo_estado");
        String finalidade = (String) info.get(0).get("finalidade");
        
        if (!"formacao".equals(finalidade)) {
            if (!"rascunho".equals(ifoEstado)) {
                throw new ApiException(403, "Fora da Formação, apenas IFOs em rascunho podem ser editados.");
            }
            return;
        }

        if ("publicado".equals(cicloEstado)) {
            throw new ApiException(403, "Não é possível alterar IFOs de um ciclo já publicado.");
        }

        List<Map<String, Object>> rows = jdbc.queryForList("SELECT is_superadmin FROM users WHERE id = ?", userId);
        boolean isSuperAdmin = !rows.isEmpty() && Boolean.TRUE.equals(rows.get(0).get("is_superadmin"));
        if (isSuperAdmin) return;

        String estadoMap = "aberto_aguardando_proad".equals(cicloEstado) ? "AGUARDANDO_PROAD" : cicloEstado.toUpperCase();
        String tagNecessaria = "PCA_" + prefixoAcao + "_" + estadoMap;
        List<String> userTags = permissoesAcoesService.buscarTagsDoUsuario(userId);
        
        if (!userTags.contains(tagNecessaria)) {
            throw new ApiException(403, "Permissão negada. Ação exige a tag: " + tagNecessaria);
        }
    }

    @Transactional
    public IfoDto atualizar(long id, AtualizarIfoRequest req, Long userId) {
        verificarPermissaoEdicao(id, "MODIFICAR_IFO", userId);
        
        if (req.bloco() == null || !BLOCOS.contains(req.bloco())) throw new ApiException(400, "Bloco inválido");
        if (req.natureza() != null && !NATUREZAS.contains(req.natureza())) throw new ApiException(400, "Natureza inválida");

        Long cents = req.valorEstimado() == null ? null : Math.round(req.valorEstimado() * 100);

        String currentBloco = jdbc.queryForObject("SELECT bloco FROM ifo WHERE id = ?", String.class, id);

        if (List.of("plurianual", "encerramento", "renovacao").contains(currentBloco)) {
            jdbc.update("UPDATE ifo SET valor_estimado_cents=?, updated_at=NOW(), updated_by=? WHERE id=?", cents, userId, id);
        } else {
            jdbc.update(
                "UPDATE ifo SET bloco=?, natureza=?, objeto=?, area_demandante=?, unidade_id=?, area_id=?, " +
                "valor_estimado_cents=?, interesse_renovacao=?, description=?, justification=?, process=?, " +
                "financial_resource_type=?, contract_type=?, formalized_value_cents=?, id_cadastros_areas=?, " +
                "priority=?, estimated_date=?, updated_at=NOW(), updated_by=? WHERE id=?",
                req.bloco(), req.natureza(), req.objeto(), req.areaDemandante(), req.unidadeId(), req.areaId(),
                cents, req.interesseRenovacao(), req.description(), req.justification(), req.process(),
                req.financialResourceType(), req.contractType(), req.formalizedValueCents(), req.idCadastrosAreas(),
                req.priority(), req.estimatedDate(), userId, id
            );
        }

        invalidarPorEdicao(id, userId);
        return get(id);
    }

    @Transactional
    public IfoDto atualizarContratos(long id, List<Long> contratosIds, Long userId) {
        verificarPermissaoEdicao(id, "VINCULAR_CONTRATOS", userId);
        
        jdbc.update("DELETE FROM ifo_contratos WHERE ifo_id = ?", id);
        vincularContratos(id, contratosIds);
        
        invalidarPorEdicao(id, userId);
        return get(id);
    }

    @Transactional
    public IfoDto enviarCca(long id, Long userId) {
        var rows = jdbc.queryForList(
                "UPDATE ifo SET estado = 'enviado_cca', updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ? AND estado = 'rascunho' RETURNING id",
                userId, id);
        if (rows.isEmpty()) {
            throw new ApiException(400, "IFO não encontrado ou já enviado à CCA");
        }
        return get(id);
    }

    /**
     * RF-41/49/75 — na publicação, converte 1:1 cada IFO não publicado do ano em código oficial de
     * Item de PCA (numeração sequencial após o maior código já existente no PCA-TIC do ano) e marca
     * o IFO como publicado. Retorna quantos IFOs foram convertidos.
     */
    @Transactional
    public int converterNaPublicacao(Integer ano, Long userId) {
        if (ano == null) return 0;
        List<Map<String, Object>> ifos = jdbc.queryForList(
                "SELECT * FROM ifo WHERE ano = ? AND estado <> 'publicado' ORDER BY codigo", ano);
        if (ifos.isEmpty()) return 0;
        Integer base = jdbc.queryForObject(
                "SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) " +
                        "FROM pcas WHERE year = ?",
                Integer.class, String.valueOf(ano));
        int prox = (base == null ? 0 : base) + 1;
        for (Map<String, Object> row : ifos) {
            Long id = asLong(row.get("id"));
            String codigoOficial = String.valueOf(prox);
            // RF-41/49/58 — materializa o IFO como Item de PCA oficial (linha viva em `pcas`) da versão
            // que está sendo publicada. contract_type derivado do bloco (Renovação vs demais → Nova Contratação).
            String contractType = "renovacao".equals(str(row.get("bloco"))) ? "RENOVACAO" : "NOVA_CONTRATACAO";
            Long unidadeId = asLong(row.get("unidade_id"));
            jdbc.update(
                    "INSERT INTO pcas (code, contract_type, directory_acronym, object_name, estimated_value_cents, " +
                            "status, year, id_diretoria, id_cadastros_areas, created_by) " +
                            "VALUES (?, ?, ?, ?, COALESCE(?, 0), 'NAO_INICIADA', ?, ?, " +
                            "(SELECT area_id FROM cadastros_unidades WHERE id = ?), ?)",
                    codigoOficial, contractType, str(row.get("area_demandante")), str(row.get("objeto")),
                    asLong(row.get("valor_estimado_cents")), String.valueOf(ano), unidadeId, unidadeId, userId);
            jdbc.update(
                    "UPDATE ifo SET codigo_oficial = ?, estado = 'publicado', updated_at = NOW(), updated_by = ? WHERE id = ?",
                    codigoOficial, userId, id);
            prox++;
        }
        return ifos.size();
    }

    /**
     * RF-07 — define o interesse na renovação de um IFO do bloco Renovação. "Não" reclassifica
     * automaticamente para Encerramento, registrando o motivo em metadado; "Sim" mantém em Renovação.
     * Só atua sobre IFO em rascunho.
     */
    @Transactional
    public IfoDto definirInteresseRenovacao(long id, boolean interesse, String motivo, Long userId) {
        IfoDto ifo = get(id);
        if (!"rascunho".equals(ifo.estado())) {
            throw new ApiException(400, "IFO já enviado à CCA não pode ser reclassificado");
        }
        if (!"renovacao".equals(ifo.bloco()) && !"encerramento".equals(ifo.bloco())) {
            throw new ApiException(400, "Interesse na renovação só se aplica ao bloco Renovação");
        }
        if (interesse) {
            jdbc.update(
                    "UPDATE ifo SET interesse_renovacao = TRUE, interesse_renovacao_confirmado = TRUE, bloco = 'renovacao', motivo_reclassificacao = NULL, " +
                            "updated_at = NOW(), updated_by = ? WHERE id = ?",
                    userId, id);
        } else {
            String m = (motivo == null || motivo.isBlank()) ? "Sem interesse na renovação" : motivo.trim();
            jdbc.update(
                    "UPDATE ifo SET interesse_renovacao = FALSE, interesse_renovacao_confirmado = TRUE, bloco = 'encerramento', motivo_reclassificacao = ?, " +
                            "updated_at = NOW(), updated_by = ? WHERE id = ?",
                    m, userId, id);
        }
        // RN-GERAL-07 — alterar o bloco é edição de conteúdo: derruba validações da demanda.
        invalidarPorEdicao(id, userId);
        return get(id);
    }

    // ---------- validação por demanda (§8.4 / RN-GERAL-06/07/08) ----------

    /**
     * Valida uma demanda (IFO) numa das 2 camadas. 1ª camada = Gestor Demandante; 2ª camada = Diretor
     * de Área (RN-GERAL-06: a 2ª só habilita sobre demanda já em 1ª). Ambas são atos de Autoridade do
     * escopo Demandante. Só atua sobre IFO em rascunho (ainda não remetido/congelado).
     */
    @Transactional
    public IfoDto validarDemanda(long id, int camada, Long userId) {
        IfoDto ifo = get(id);
        papelService.exigirTransicao("demandante", ifo.cicloId());
        if (!"rascunho".equals(ifo.estado())) {
            throw new ApiException(400, "IFO já remetido à CCA não pode ser validado");
        }
        String atual = jdbc.queryForObject("SELECT validacao FROM ifo WHERE id = ?", String.class, id);
        if (camada == 1) {
            jdbc.update("UPDATE ifo SET validacao = 'validada_1a', validado_1a_por = ?, validado_1a_em = NOW(), " +
                    "updated_at = NOW(), updated_by = ? WHERE id = ?", userId, userId, id);
        } else if (camada == 2) {
            if (!"validada_1a".equals(atual)) {
                throw new ApiException(409, "Valide a 1ª camada antes da 2ª (RN-GERAL-06)");
            }
            jdbc.update("UPDATE ifo SET validacao = 'validada_2a', validado_2a_por = ?, validado_2a_em = NOW(), " +
                    "updated_at = NOW(), updated_by = ? WHERE id = ?", userId, userId, id);
        } else {
            throw new ApiException(400, "Camada inválida (use 1 ou 2)");
        }
        return get(id);
    }

    /** Devolve a demanda à edição (Autoridade Demandante), derrubando as validações (RN-GERAL-07). */
    @Transactional
    public IfoDto devolverDemanda(long id, Long userId) {
        IfoDto ifo = get(id);
        papelService.exigirTransicao("demandante", ifo.cicloId());
        invalidarPorEdicao(id, userId);
        return get(id);
    }

    /** RN-GERAL-07 — reseta a validação da demanda (editar derruba as validações posteriores). */
    private void invalidarPorEdicao(long id, Long userId) {
        jdbc.update("UPDATE ifo SET validacao = 'em_edicao', validado_1a_por = NULL, validado_1a_em = NULL, " +
                "validado_2a_por = NULL, validado_2a_em = NULL, updated_at = NOW(), updated_by = ? WHERE id = ?",
                userId, id);
    }

    /**
     * RN-GERAL-08 — remessa da partição (todos os IFO de uma unidade no ciclo) à CCA. Ato único da
     * Autoridade Demandante (Diretor), só habilitado com TODAS as demandas em 2ª camada. Congela a
     * partição (rascunho → enviado_cca). Retorna quantas demandas foram remetidas.
     */
    @Transactional
    public int remeterParticao(long cicloId, long unidadeId, Long userId) {
        papelService.exigirTransicao("demandante", cicloId);
        Integer pendentes = jdbc.queryForObject(
                "SELECT COUNT(*) FROM ifo WHERE ciclo_id = ? AND unidade_id = ? AND estado = 'rascunho' " +
                        "AND validacao <> 'validada_2a'",
                Integer.class, cicloId, unidadeId);
        if (pendentes != null && pendentes > 0) {
            throw new ApiException(409, "Há demandas não validadas em 2ª camada; a partição não pode ser remetida");
        }
        return jdbc.update("UPDATE ifo SET estado = 'enviado_cca', updated_at = NOW(), updated_by = ? " +
                "WHERE ciclo_id = ? AND unidade_id = ? AND estado = 'rascunho'", userId, cicloId, unidadeId);
    }

    /** Devolução da partição pela CCA (Autoridade CCA) à área, reabrindo para edição. */
    @Transactional
    public int devolverParticao(long cicloId, long unidadeId, Long userId) {
        papelService.exigirTransicao("cca", cicloId);
        return jdbc.update("UPDATE ifo SET estado = 'rascunho', validacao = 'em_edicao', " +
                "validado_1a_por = NULL, validado_1a_em = NULL, validado_2a_por = NULL, validado_2a_em = NULL, " +
                "updated_at = NOW(), updated_by = ? WHERE ciclo_id = ? AND unidade_id = ? AND estado = 'enviado_cca'",
                userId, cicloId, unidadeId);
    }

    @Transactional
    public void excluir(long id, Long userId) {
        verificarPermissaoEdicao(id, "DELETAR_IFO", userId);
        int n = jdbc.update("UPDATE ifo SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? WHERE id = ?", userId, id);
        if (n == 0) {
            throw new ApiException(404, "IFO não encontrado");
        }
    }

    public IfoDto get(long id) {
        var rows = jdbc.queryForList("SELECT * FROM ifo WHERE id = ?", id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "IFO não encontrado");
        }
        return toDto(rows.get(0));
    }

    public List<IfoDto> listar(Integer ano, Long cicloId, Boolean minhasDemandas, Long userId) {
        if (cicloId != null && userId != null) {
            try {
                var cicloMap = jdbc.queryForMap("SELECT finalidade, estado FROM ciclo_orcamentario WHERE id = ?", cicloId);
                if ("formacao".equals(cicloMap.get("finalidade"))) {
                    String estado = (String) cicloMap.get("estado");
                    if (!"publicado".equals(estado)) {
                        List<Map<String, Object>> rows = jdbc.queryForList("SELECT is_superadmin FROM users WHERE id = ?", userId);
                        boolean isSuperAdmin = !rows.isEmpty() && Boolean.TRUE.equals(rows.get(0).get("is_superadmin"));
                        if (!isSuperAdmin) {
                            List<String> tagsPermitidas = TAGS_ACESSO_POR_ESTADO.getOrDefault(estado, List.of());
                            List<String> userTags = permissoesAcoesService.buscarTagsDoUsuario(userId);
                            boolean temAcesso = tagsPermitidas.stream().anyMatch(userTags::contains);
                            if (!temAcesso) {
                                throw new ApiException(403, "Acesso restrito à fase atual do ciclo de formação.");
                            }
                        }
                    }
                }
            } catch (ApiException e) {
                throw e;
            } catch (Exception e) {
                // Ignore if cycle not found
            }
        }

        StringBuilder sql = new StringBuilder("SELECT * FROM ifo WHERE is_deleted = FALSE");
        List<Object> params = new ArrayList<>();
        if (ano != null) {
            sql.append(" AND ano = ?");
            params.add(ano);
        }
        if (cicloId != null) {
            sql.append(" AND ciclo_id = ?");
            params.add(cicloId);
        }
        if (Boolean.TRUE.equals(minhasDemandas) && userId != null) {
            List<Long> userAreaIds = new ArrayList<>();
            List<Long> userUnidadeIds = new ArrayList<>();
            try {
                var pessoas = jdbc.queryForList("SELECT area_id, unidade_id FROM cadastros_pessoas WHERE user_id = ?", userId);
                for (var p : pessoas) {
                    if (p.get("area_id") != null) userAreaIds.add(((Number) p.get("area_id")).longValue());
                    if (p.get("unidade_id") != null) userUnidadeIds.add(((Number) p.get("unidade_id")).longValue());
                }
            } catch (Exception e) {}

            if (userAreaIds.isEmpty()) {
                try {
                    var users = jdbc.queryForList("SELECT diretoria FROM users WHERE id = ? LIMIT 1", userId);
                    if (!users.isEmpty() && users.get(0).get("diretoria") != null) {
                        String diretoria = (String) users.get(0).get("diretoria");
                        var areas = jdbc.queryForList("SELECT id FROM cadastros_areas WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) LIMIT 1", diretoria);
                        if (!areas.isEmpty()) {
                            userAreaIds.add(((Number) areas.get(0).get("id")).longValue());
                        }
                    }
                } catch (Exception e) {}
            }
            
            if (userAreaIds.isEmpty() && userUnidadeIds.isEmpty()) {
                sql.append(" AND 1 = 0"); // Força retornar vazio se não tiver área
            } else {
                sql.append(" AND (");
                if (!userAreaIds.isEmpty()) {
                    sql.append("area_id IN (").append(userAreaIds.stream().map(String::valueOf).collect(Collectors.joining(","))).append(")");
                } else {
                    sql.append("1 = 0");
                }
                sql.append(" OR ");
                if (!userUnidadeIds.isEmpty()) {
                    sql.append("unidade_id IN (").append(userUnidadeIds.stream().map(String::valueOf).collect(Collectors.joining(","))).append(")");
                } else {
                    sql.append("1 = 0");
                }
                sql.append(")");
            }
        }
        sql.append(" ORDER BY codigo");
        return jdbc.queryForList(sql.toString(), params.toArray()).stream().map(this::toDto).toList();
    }

    private void vincularContratos(Long ifoId, List<Long> contratos) {
        if (contratos == null) return;
        for (Long contractId : contratos) {
            if (contractId == null) continue;
            jdbc.update(
                    "INSERT INTO ifo_contratos (ifo_id, contract_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                    ifoId, contractId);
        }
    }

    private List<Long> contratosDoIfo(long ifoId) {
        return jdbc.query(
                "SELECT contract_id FROM ifo_contratos WHERE ifo_id = ? ORDER BY contract_id",
                (rs, i) -> rs.getLong("contract_id"), ifoId);
    }

    private IfoDto toDto(Map<String, Object> r) {
        Long id = asLong(r.get("id"));
        Long cents = asLong(r.get("valor_estimado_cents"));
        return new IfoDto(
                id,
                str(r.get("codigo")),
                asInt(r.get("ano")),
                asLong(r.get("ciclo_id")),
                str(r.get("bloco")),
                str(r.get("natureza")),
                str(r.get("objeto")),
                str(r.get("area_demandante")),
                asLong(r.get("unidade_id")),
                asLong(r.get("area_id")),
                str(r.get("estado")),
                cents == null ? null : cents / 100.0,
                (Boolean) r.get("interesse_renovacao"),
                (Boolean) r.get("interesse_renovacao_confirmado"),
                str(r.get("motivo_reclassificacao")),
                str(r.get("codigo_oficial")),
                str(r.get("validacao")),
                str(r.get("description")),
                str(r.get("justification")),
                str(r.get("process")),
                str(r.get("financial_resource_type")),
                str(r.get("contract_type")),
                asLong(r.get("formalized_value_cents")),
                asLong(r.get("id_cadastros_areas")),
                str(r.get("priority")),
                r.get("estimated_date") != null ? ((java.sql.Date) r.get("estimated_date")).toLocalDate() : null,
                contratosDoIfo(id));
    }

    @Transactional
    public void gerarIfosRenovacao(long cicloId, int anoFormacao, Long userId) {
        var check = jdbc.queryForList("SELECT id FROM ifo WHERE ciclo_id = ? AND bloco = 'renovacao' LIMIT 1", cicloId);
        if (!check.isEmpty()) return;

        String queryContratos = "SELECT c.id as contract_id, c.object_name, c.total_value_cents, c.directory, c.unidade, " +
                "c.cadastro_unidade_id, c.cadastro_area_id, cp.pca_id, " +
                "c.start_date, c.limit_date, COALESCE(c.year_duration_standard, 10) as year_duration_standard " +
                "FROM contracts c " +
                "LEFT JOIN contracts_pcas cp ON c.id = cp.contract_id " +
                "WHERE EXTRACT(YEAR FROM c.limit_date) >= ? AND (c.is_deleted = FALSE OR c.is_deleted IS NULL) " +
                "ORDER BY c.id";

        List<Map<String, Object>> contratosRenovacao = jdbc.queryForList(queryContratos, anoFormacao);

        Map<Long, Map<String, List<Map<String, Object>>>> porPcaEBloco = new java.util.LinkedHashMap<>();
        List<Map<String, Object>> avulsos = new java.util.ArrayList<>();

        for (Map<String, Object> c : contratosRenovacao) {
            String bloco = "renovacao"; // fallback
            
            java.sql.Date sqlStartDate = (java.sql.Date) c.get("start_date");
            java.sql.Date sqlLimitDate = (java.sql.Date) c.get("limit_date");
            
            if (sqlStartDate != null && sqlLimitDate != null) {
                int startYear = sqlStartDate.toLocalDate().getYear();
                int limitYear = sqlLimitDate.toLocalDate().getYear();
                int duration = ((Number) c.get("year_duration_standard")).intValue();
                
                if (limitYear >= anoFormacao + 2) {
                    bloco = "plurianual";
                } else if (startYear <= (anoFormacao + 1) - duration) {
                    bloco = "encerramento";
                } else if (startYear + duration > anoFormacao + 1) {
                    bloco = "renovacao";
                }
            }
            c.put("bloco_calculado", bloco);

            Long pcaId = asLong(c.get("pca_id"));
            if (pcaId != null) {
                porPcaEBloco.computeIfAbsent(pcaId, k -> new java.util.LinkedHashMap<>())
                            .computeIfAbsent(bloco, k -> new java.util.ArrayList<>())
                            .add(c);
            } else {
                avulsos.add(c);
            }
        }

        for (Map.Entry<Long, Map<String, List<Map<String, Object>>>> pcaEntry : porPcaEBloco.entrySet()) {
            Long pcaId = pcaEntry.getKey();

            var pcaRows = jdbc.queryForList(
                    "SELECT object_name, directory_acronym, estimated_value_cents, id_diretoria, " +
                    "id_cadastros_areas, id_area_demandante, priority, description, justification, " +
                    "process, financial_resource_type, contract_type, formalized_value_cents " +
                    "FROM pcas WHERE id = ?", pcaId);

            if (pcaRows.isEmpty()) continue;
            Map<String, Object> pca = pcaRows.get(0);
            
            for (Map.Entry<String, List<Map<String, Object>>> blocoEntry : pcaEntry.getValue().entrySet()) {
                String bloco = blocoEntry.getKey();
                List<Map<String, Object>> contratosDoPca = blocoEntry.getValue();

                String codigo = gerarCodigo(anoFormacao);

                Long areaId = asLong(pca.get("id_cadastros_areas"));
                Long unidadeId = asLong(pca.get("id_area_demandante"));
                String areaDemandanteText = str(pca.get("directory_acronym"));
                
                if (areaId == null || unidadeId == null) {
                    Map<String, Object> firstContract = contratosDoPca.isEmpty() ? null : contratosDoPca.get(0);
                    if (firstContract != null) {
                        if (areaId == null) areaId = asLong(firstContract.get("cadastro_area_id"));
                        if (unidadeId == null) unidadeId = asLong(firstContract.get("cadastro_unidade_id"));
                        if (areaDemandanteText == null || areaDemandanteText.isBlank() || "null".equals(areaDemandanteText)) {
                            areaDemandanteText = str(firstContract.get("unidade") != null ? firstContract.get("unidade") : firstContract.get("directory"));
                        }
                        
                        if (areaId == null && firstContract.get("directory") != null) {
                            String dirStr = str(firstContract.get("directory"));
                            var res = jdbc.queryForList("SELECT id FROM cadastros_areas WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) OR LOWER(TRIM(nome)) = LOWER(TRIM(?)) LIMIT 1", dirStr, dirStr);
                            if (!res.isEmpty()) areaId = asLong(res.get(0).get("id"));
                        }
                        if (unidadeId == null && areaDemandanteText != null) {
                            var res = jdbc.queryForList("SELECT id FROM cadastros_unidades WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) OR LOWER(TRIM(nome)) = LOWER(TRIM(?)) LIMIT 1", areaDemandanteText, areaDemandanteText);
                            if (!res.isEmpty()) unidadeId = asLong(res.get(0).get("id"));
                        }
                    }
                }

                if (areaId != null) {
                    var resArea = jdbc.queryForList("SELECT sigla FROM cadastros_areas WHERE id = ?", areaId);
                    if (!resArea.isEmpty() && resArea.get(0).get("sigla") != null) {
                        areaDemandanteText = str(resArea.get(0).get("sigla"));
                    }
                }

                var inserted = jdbc.queryForList(
                        "INSERT INTO ifo (codigo, ano, ciclo_id, bloco, natureza, estado, interesse_renovacao, " +
                        "objeto, area_demandante, unidade_id, area_id, valor_estimado_cents, " +
                        "description, justification, process, financial_resource_type, contract_type, " +
                        "formalized_value_cents, id_cadastros_areas, priority, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, 'continuada', 'rascunho', TRUE, " +
                        "?, ?, ?, ?, COALESCE(?, 0), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                        codigo, anoFormacao, cicloId, bloco,
                        str(pca.get("object_name")), areaDemandanteText,
                        unidadeId, areaId,
                        asLong(pca.get("estimated_value_cents")),
                        str(pca.get("description")), str(pca.get("justification")), str(pca.get("process")),
                        str(pca.get("financial_resource_type")), str(pca.get("contract_type")),
                        asLong(pca.get("formalized_value_cents")), asLong(pca.get("id_cadastros_areas")),
                        str(pca.get("priority")), userId, userId);

                Long ifoId = asLong(inserted.get(0).get("id"));

                for (Map<String, Object> c : contratosDoPca) {
                    Long contractId = asLong(c.get("contract_id"));
                    jdbc.update("INSERT INTO ifo_contratos (ifo_id, contract_id) VALUES (?, ?) ON CONFLICT DO NOTHING", ifoId, contractId);
                }
            }
        }

        for (Map<String, Object> c : avulsos) {
            String codigo = gerarCodigo(anoFormacao);
            String bloco = (String) c.get("bloco_calculado");
            Long unidadeId = asLong(c.get("cadastro_unidade_id"));
            Long areaId = asLong(c.get("cadastro_area_id"));
            String areaDemandanteText = str(c.get("unidade") != null ? c.get("unidade") : c.get("directory"));
            
            if (areaId == null && c.get("directory") != null) {
                String dirStr = str(c.get("directory"));
                var res = jdbc.queryForList("SELECT id FROM cadastros_areas WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) OR LOWER(TRIM(nome)) = LOWER(TRIM(?)) LIMIT 1", dirStr, dirStr);
                if (!res.isEmpty()) areaId = asLong(res.get(0).get("id"));
            }
            if (unidadeId == null && areaDemandanteText != null) {
                var res = jdbc.queryForList("SELECT id FROM cadastros_unidades WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) OR LOWER(TRIM(nome)) = LOWER(TRIM(?)) LIMIT 1", areaDemandanteText, areaDemandanteText);
                if (!res.isEmpty()) unidadeId = asLong(res.get(0).get("id"));
            }

            if (areaId != null) {
                var resArea = jdbc.queryForList("SELECT sigla FROM cadastros_areas WHERE id = ?", areaId);
                if (!resArea.isEmpty() && resArea.get(0).get("sigla") != null) {
                    areaDemandanteText = str(resArea.get(0).get("sigla"));
                }
            }

            var inserted = jdbc.queryForList(
                    "INSERT INTO ifo (codigo, ano, ciclo_id, bloco, natureza, estado, interesse_renovacao, " +
                    "objeto, area_demandante, unidade_id, area_id, id_cadastros_areas, valor_estimado_cents, " +
                    "created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, 'continuada', 'rascunho', TRUE, " +
                    "?, ?, ?, ?, ?, COALESCE(?, 0), ?, ?) RETURNING id",
                    codigo, anoFormacao, cicloId, bloco,
                    str(c.get("object_name")), areaDemandanteText,
                    unidadeId, areaId, areaId, asLong(c.get("total_value_cents")),
                    userId, userId);

            Long ifoId = asLong(inserted.get(0).get("id"));
            Long contractId = asLong(c.get("contract_id"));
            jdbc.update("INSERT INTO ifo_contratos (ifo_id, contract_id) VALUES (?, ?) ON CONFLICT DO NOTHING", ifoId, contractId);
        }
    }

    private static Long asLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }

    private static Integer asInt(Object v) {
        return v == null ? null : ((Number) v).intValue();
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
