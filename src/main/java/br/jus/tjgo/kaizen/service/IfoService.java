package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.dto.AtualizarIfoRequest;
import br.jus.tjgo.kaizen.dto.CriarIfoRequest;
import br.jus.tjgo.kaizen.dto.IfoContratoDto;
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
    private final DelegacaoEdicaoService delegacaoEdicaoService;

    // Domínios validados aqui no backend — os CHECK foram removidos do banco (migration 172).
    private static final List<String> BLOCOS =
            List.of("encerramento", "renovacao", "plurianual", "nova_contratacao");

    private static final List<String> NATUREZAS = List.of("continuada", "pontual");

    private static final Map<String, List<String>> TAGS_ACESSO_POR_ESTADO = Map.ofEntries(
        Map.entry("aguardando_proad", List.of("PCA_FORMACAO_ABERTURA", "PCA_FOR_REGISTRAR_PROAD", "PCA_FOR_ENCAMINHAR_CONSULTA", 
            "PCA_FOR_MODIFICAR_IFO_AGUARDANDO_PROAD", "PCA_FOR_DELETAR_IFO_AGUARDANDO_PROAD", "PCA_FOR_VINCULAR_CONTRATOS_AGUARDANDO_PROAD")),
        Map.entry("aberto_aguardando_proad", List.of("PCA_FORMACAO_ABERTURA", "PCA_FOR_REGISTRAR_PROAD", "PCA_FOR_ENCAMINHAR_CONSULTA",
            "PCA_FOR_MODIFICAR_IFO_AGUARDANDO_PROAD", "PCA_FOR_DELETAR_IFO_AGUARDANDO_PROAD", "PCA_FOR_VINCULAR_CONTRATOS_AGUARDANDO_PROAD")),
        Map.entry("aberto", List.of("PCA_FORMACAO_ABERTURA", "PCA_FOR_REGISTRAR_PROAD", "PCA_FOR_ENCAMINHAR_CONSULTA",
            "PCA_FOR_MODIFICAR_IFO_ABERTO", "PCA_FOR_DELETAR_IFO_ABERTO", "PCA_FOR_VINCULAR_CONTRATOS_ABERTO")),
        Map.entry("em_consulta_1", List.of("PCA_FOR_VALIDAR_DEMANDA_1_CAMADA", "PCA_FOR_VALIDAR_DEMANDA_2_CAMADA", "PCA_FOR_REMETER_PARTICAO",
            "PCA_FOR_MODIFICAR_IFO_EM_CONSULTA_1", "PCA_FOR_DELETAR_IFO_EM_CONSULTA_1", "PCA_FOR_VINCULAR_CONTRATOS_EM_CONSULTA_1")),
        Map.entry("em_consulta_2", List.of("PCA_FOR_VALIDAR_DEMANDA_1_CAMADA", "PCA_FOR_VALIDAR_DEMANDA_2_CAMADA", "PCA_FOR_REMETER_PARTICAO",
            "PCA_FOR_MODIFICAR_IFO_EM_CONSULTA_2", "PCA_FOR_DELETAR_IFO_EM_CONSULTA_2", "PCA_FOR_VINCULAR_CONTRATOS_EM_CONSULTA_2")),
        Map.entry("consolidacao_cca", List.of("PCA_FOR_CONSOLIDAR_ENCAMINHAR_GEJUT",
            "PCA_FOR_MODIFICAR_IFO_CONSOLIDACAO_CCA", "PCA_FOR_DELETAR_IFO_CONSOLIDACAO_CCA", "PCA_FOR_VINCULAR_CONTRATOS_CONSOLIDACAO_CCA")),
        Map.entry("validacao_gejut", List.of("PCA_FOR_ENCAMINHAR_SGJT",
            "PCA_FOR_MODIFICAR_IFO_VALIDACAO_GEJUT", "PCA_FOR_DELETAR_IFO_VALIDACAO_GEJUT", "PCA_FOR_VINCULAR_CONTRATOS_VALIDACAO_GEJUT")),
        Map.entry("apreciacao_sgjt", List.of("PCA_FOR_PAUTAR_COMITES",
            "PCA_FOR_MODIFICAR_IFO_APRECIACAO_SGJT", "PCA_FOR_DELETAR_IFO_APRECIACAO_SGJT", "PCA_FOR_VINCULAR_CONTRATOS_APRECIACAO_SGJT")),
        Map.entry("em_comites", List.of("PCA_FOR_AUTORIZAR_COMITES",
            "PCA_FOR_MODIFICAR_IFO_EM_COMITES", "PCA_FOR_DELETAR_IFO_EM_COMITES", "PCA_FOR_VINCULAR_CONTRATOS_EM_COMITES")),
        Map.entry("remessa_dg", List.of("PCA_FOR_REMETER_DG",
            "PCA_FOR_MODIFICAR_IFO_REMESSA_DG", "PCA_FOR_DELETAR_IFO_REMESSA_DG", "PCA_FOR_VINCULAR_CONTRATOS_REMESSA_DG")),
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
                "INSERT INTO ifo (codigo, ano, ciclo_id, bloco, natureza, objeto, " +
                        "cadastros_unidades_id, cadastros_areas_id, estado, valor_estimado_cents, interesse_renovacao, " +
                        "strategic_objective, is_sustainable, is_shared_acquisition, quantity, " +
                        "description, justification, process, financial_resource_type, contract_type, expense_nature, " +
                        "formalized_value_cents, priority, estimated_date, " +
                        "created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                codigo, req.ano(), req.cicloId(), req.bloco(), req.natureza(), req.objeto(),
                req.cadastrosUnidadesId(), req.cadastrosAreasId(), cents, req.interesseRenovacao(),
                req.strategicObjective(), req.isSustainable(), req.isSharedAcquisition(), req.quantity(),
                req.description(), req.justification(), req.process(), req.financialResourceType(), req.contractType(), req.expenseNature(),
                req.formalizedValueCents(), req.priority(), req.estimatedDate(),
                userId, userId);

        Long ifoId = asLong(rows.get(0).get("id"));
        vincularContratos(ifoId, req.contratos(), userId);
        return get(ifoId);
    }

    private void verificarPermissaoEdicao(long ifoId, String prefixoAcao, Long userId) {
        if (userId == null) throw new ApiException(403, "Usuário não identificado");
        var info = jdbc.queryForList(
            "SELECT i.estado as ifo_estado, c.estado as ciclo_estado, c.finalidade, i.ciclo_id " +
            "FROM ifo i " +
            "JOIN ciclo_orcamentario c ON i.ciclo_id = c.id " +
            "WHERE i.id = ?", ifoId);
        
        if (info.isEmpty()) throw new ApiException(404, "IFO não encontrado");
        
        String ifoEstado = (String) info.get(0).get("ifo_estado");
        String cicloEstado = (String) info.get(0).get("ciclo_estado");
        String finalidade = (String) info.get(0).get("finalidade");
        Long cicloId = info.get(0).get("ciclo_id") != null
                ? ((Number) info.get(0).get("ciclo_id")).longValue() : null;
        
        if (!"formacao".equals(finalidade)) {
            if (!"rascunho".equals(ifoEstado)) {
                throw new ApiException(403, "Fora da Formação, apenas IFOs em rascunho podem ser editados.");
            }
            return;
        }

        if ("publicado".equals(cicloEstado)) {
            throw new ApiException(403, "Não é possível alterar IFOs de um ciclo já publicado.");
        }

        var optUser = br.jus.tjgo.kaizen.auth.AuthContext.getCurrentUser();
        if (optUser.isPresent() && optUser.get().isSuperadmin()) return;

        List<String> userTags = permissoesAcoesService.buscarTagsDoUsuario(userId);

        // Caminho 1: permissão de modificação especial (tag direta)
        boolean isEspecial = (userTags.contains("PCA_FOR_MODIFICACAO_ESPECIAL") || userTags.contains("PCA_FOR_MODIFICACAO_CCA")) && 
            List.of("aguardando_proad", "aberto_aguardando_proad", "aberto", "em_consulta_1", "em_consulta_2", "consolidacao_cca", "validacao_gejut", "apreciacao_sgjt", "em_comites", "remessa_dg").contains(cicloEstado);
        
        if (isEspecial && ("MODIFICAR_IFO".equals(prefixoAcao) || "VINCULAR_CONTRATOS".equals(prefixoAcao))) {
            return;
        }

        // Caminho 2: herança por tag de transição — quem pode transitar a etapa pode editar/excluir
        if (cicloId != null && delegacaoEdicaoService.temTagTransicao(cicloEstado, userId)) {
            return;
        }

        // Caminho 3: delegação ativa — quem recebeu delegação pode editar/excluir
        if (cicloId != null) {
            String tipoDelegacao = delegacaoEdicaoService.tipoDelegacao(cicloId, cicloEstado, userId);
            if (tipoDelegacao != null) {
                // Delegação 'especial' herda o bypass de campos restringidos
                if ("especial".equals(tipoDelegacao) && ("MODIFICAR_IFO".equals(prefixoAcao) || "VINCULAR_CONTRATOS".equals(prefixoAcao))) {
                    return;
                }
                // Delegação 'normal' permite edição e exclusão padrão
                return;
            }
        }

        // Caminho 4: tag granular por estado (comportamento original)
        String estadoMap = "aberto_aguardando_proad".equals(cicloEstado) ? "AGUARDANDO_PROAD" : cicloEstado.toUpperCase();
        String tagNecessaria = "PCA_FOR_" + prefixoAcao + "_" + estadoMap;
        
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

        var info = jdbc.queryForList("SELECT c.estado as ciclo_estado FROM ifo i JOIN ciclo_orcamentario c ON i.ciclo_id = c.id WHERE i.id = ?", id);
        String cicloEstado = info.isEmpty() ? "" : (String) info.get(0).get("ciclo_estado");
        List<String> userTags = permissoesAcoesService.buscarTagsDoUsuario(userId);
        boolean isEspecial = (userTags.contains("PCA_FOR_MODIFICACAO_ESPECIAL") || userTags.contains("PCA_FOR_MODIFICACAO_CCA")) && 
            List.of("aguardando_proad", "aberto_aguardando_proad", "aberto", "em_consulta_1", "em_consulta_2", "consolidacao_cca", "validacao_gejut", "apreciacao_sgjt", "em_comites", "remessa_dg").contains(cicloEstado);
        
        var optUser = br.jus.tjgo.kaizen.auth.AuthContext.getCurrentUser();
        boolean isSuperAdmin = optUser.isPresent() && optUser.get().isSuperadmin();

        if (!isSuperAdmin && !isEspecial && List.of("plurianual", "encerramento", "renovacao").contains(currentBloco)) {
            jdbc.update("UPDATE ifo SET valor_estimado_cents=?, is_sustainable=?, is_shared_acquisition=?, quantity=?, priority=?, financial_resource_type=?, updated_at=NOW(), updated_by=? WHERE id=?", 
                cents, req.isSustainable(), req.isSharedAcquisition(), req.quantity(), req.priority(), req.financialResourceType(), userId, id);
        } else {
            jdbc.update(
                "UPDATE ifo SET bloco=?, natureza=?, objeto=?, cadastros_unidades_id=?, cadastros_areas_id=?, " +
                "valor_estimado_cents=?, interesse_renovacao=?, strategic_objective=?, is_sustainable=?, is_shared_acquisition=?, quantity=?, " +
                "description=?, justification=?, process=?, " +
                "financial_resource_type=?, contract_type=?, expense_nature=?, formalized_value_cents=?, " +
                "priority=?, estimated_date=?, updated_at=NOW(), updated_by=? WHERE id=?",
                req.bloco(), req.natureza(), req.objeto(), req.cadastrosUnidadesId(), req.cadastrosAreasId(),
                cents, req.interesseRenovacao(), req.strategicObjective(), req.isSustainable(), req.isSharedAcquisition(), req.quantity(),
                req.description(), req.justification(), req.process(),
                req.financialResourceType(), req.contractType(), req.expenseNature(), req.formalizedValueCents(),
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
        vincularContratos(id, contratosIds, userId);
        
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
     * Item de PCA (numeração sequencial após o maior código já existente no PCA-TIC do ano, 
     * ou usa os códigos enviados manualmente via importacoes) e marca o IFO como publicado. 
     * Retorna quantos IFOs foram convertidos.
     */
    @Transactional
    public int converterNaPublicacao(Integer ano, Long userId, List<br.jus.tjgo.kaizen.dto.ImportacaoPcaDto> importacoes) {
        if (ano == null) return 0;
        List<Map<String, Object>> ifos = jdbc.queryForList(
                "SELECT * FROM ifo WHERE ano = ? AND estado <> 'publicado' ORDER BY codigo", ano);
        if (ifos.isEmpty()) return 0;
        Integer base = jdbc.queryForObject(
                "SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) " +
                        "FROM pcas WHERE year = ?",
                Integer.class, String.valueOf(ano));
        int prox = (base == null ? 0 : base) + 1;
        
        java.util.Map<Long, String> codigosManuais = new java.util.HashMap<>();
        if (importacoes != null) {
            for (br.jus.tjgo.kaizen.dto.ImportacaoPcaDto dto : importacoes) {
                if (dto.codigoPca() != null && !dto.codigoPca().isBlank()) {
                    codigosManuais.put(dto.ifoId(), dto.codigoPca().trim());
                }
            }
        }

        // Verifica duplicatas na lista recebida
        java.util.Set<String> uniqueCodes = new java.util.HashSet<>();
        for (String code : codigosManuais.values()) {
            if (!uniqueCodes.add(code)) {
                throw new ApiException(400, "Foram informados códigos de PCA duplicados: " + code);
            }
        }

        for (Map<String, Object> row : ifos) {
            Long id = asLong(row.get("id"));
            String codigoOficial;
            if (codigosManuais.containsKey(id)) {
                codigoOficial = codigosManuais.get(id);
            } else {
                while (true) {
                    codigoOficial = String.valueOf(prox);
                    prox++;
                    if (!codigosManuais.containsValue(codigoOficial)) {
                        break;
                    }
                }
            }

            // Verifica se o código já existe no banco antes de tentar inserir para evitar exceção feia
            Integer exists = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pcas WHERE code = ? AND year = ? AND is_deleted = false",
                Integer.class, codigoOficial, String.valueOf(ano)
            );
            if (exists != null && exists > 0) {
                throw new ApiException(400, "O código de PCA '" + codigoOficial + "' já está em uso para o ano " + ano + ".");
            }

            // RF-41/49/58 — materializa o IFO como Item de PCA oficial (linha viva em `pcas`) da versão
            // que está sendo publicada. contract_type derivado do bloco (Renovação vs demais → Nova Contratação).
            String contractType = "renovacao".equals(str(row.get("bloco"))) ? "RENOVACAO" : "NOVA_CONTRATACAO";
            Long unidadeId = asLong(row.get("cadastros_unidades_id"));
            Long areaId = asLong(row.get("cadastros_areas_id"));
            
            jdbc.update(
                    "INSERT INTO pcas (code, contract_type, object_name, estimated_value_cents, " +
                            "formalized_value_cents, estimated_date, status, year, " +
                            "process, description, justification, financial_resource_type, priority, " +
                            "cadastros_unidades_id, cadastros_areas_id, created_by) " +
                            "VALUES (?, ?, ?, COALESCE(?, 0), COALESCE(?, 0), CAST(? AS DATE), 'NAO_INICIADA', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    codigoOficial, contractType, str(row.get("objeto")),
                    asLong(row.get("valor_estimado_cents")), asLong(row.get("formalized_value_cents")), 
                    row.get("estimated_date"), String.valueOf(ano),
                    str(row.get("process")), str(row.get("description")), str(row.get("justification")),
                    str(row.get("financial_resource_type")), 
                    str(row.get("priority")),
                    unidadeId, areaId, userId);
            
            jdbc.update(
                    "UPDATE ifo SET codigo_oficial = ?, estado = 'publicado', updated_at = NOW(), updated_by = ? WHERE id = ?",
                    codigoOficial, userId, id);
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
        if (motivo != null && motivo.length() > 128) {
            throw new ApiException(400, "O motivo deve ter no máximo 128 caracteres");
        }
        verificarPermissaoEdicao(id, "MODIFICAR_IFO", userId);
        
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

    @Transactional
    public IfoDto definirInteresseRenovacaoContrato(long ifoId, long contractId, boolean interesse, String motivo, Long userId) {
        if (motivo != null && motivo.length() > 128) {
            throw new ApiException(400, "O motivo deve ter no máximo 128 caracteres");
        }
        verificarPermissaoEdicao(ifoId, "MODIFICAR_IFO", userId);
        
        IfoDto ifo = get(ifoId);
        if (!"rascunho".equals(ifo.estado())) {
            throw new ApiException(400, "IFO já enviado à CCA não pode ser reclassificado");
        }
        if (!"renovacao".equals(ifo.bloco()) && !"encerramento".equals(ifo.bloco())) {
            throw new ApiException(400, "Interesse na renovação só se aplica ao bloco Renovação");
        }
        
        String m = (motivo == null || motivo.isBlank() || interesse) ? null : motivo.trim();
        jdbc.update(
                "UPDATE ifo_contratos SET interesse_renovacao = ?, motivo_reclassificacao = ? " +
                "WHERE ifo_id = ? AND contract_id = ?",
                interesse, m, ifoId, contractId);
        
        // RN-GERAL-07 — alterar o bloco/interesse é edição de conteúdo: derruba validações da demanda.
        invalidarPorEdicao(ifoId, userId);
        return get(ifoId);
    }

    @Transactional
    public void processarNaoRenovacoes(long cicloId, Long userId) {
        // Encontra todos os IFOs que possuem contratos marcados como NÃO renovar.
        List<Map<String, Object>> ifosComNaoRenovados = jdbc.queryForList(
            "SELECT DISTINCT ic.ifo_id " +
            "FROM ifo_contratos ic " +
            "JOIN ifo i ON ic.ifo_id = i.id " +
            "WHERE i.ciclo_id = ? AND i.bloco = 'renovacao' AND ic.interesse_renovacao = FALSE", cicloId);

        for (Map<String, Object> rowIfo : ifosComNaoRenovados) {
            Long ifoId = asLong(rowIfo.get("ifo_id"));
            
            // Busca os contratos não renovados e seus motivos para este IFO
            List<Map<String, Object>> contratosNaoRenovados = jdbc.queryForList(
                "SELECT contract_id, motivo_reclassificacao " +
                "FROM ifo_contratos " +
                "WHERE ifo_id = ? AND interesse_renovacao = FALSE", ifoId);
                
            if (contratosNaoRenovados.isEmpty()) continue;

            Long primeiroContractId = asLong(contratosNaoRenovados.get(0).get("contract_id"));

            // Pega o primeiro contrato para derivar os dados descritivos, usando queryForList para fallback seguro
            var cList = jdbc.queryForList("SELECT object_name FROM contracts WHERE id = ?", primeiroContractId);
            var ifoOriginal = jdbc.queryForMap("SELECT * FROM ifo WHERE id = ?", ifoId);
            String objectName = cList.isEmpty() ? str(ifoOriginal.get("objeto")) : str(cList.get(0).get("object_name"));
            
            String codigo = gerarCodigo(asInt(ifoOriginal.get("ano")));
            
            // Buscar o valor total de todos os contratos não renovados em uma única query
            List<Long> contractIds = contratosNaoRenovados.stream().map(m -> asLong(m.get("contract_id"))).toList();
            String inSql = String.join(",", java.util.Collections.nCopies(contractIds.size(), "?"));
            Long cents = jdbc.queryForObject(
                "SELECT SUM(total_value_cents) FROM contracts WHERE id IN (" + inSql + ")",
                Long.class, contractIds.toArray());
            if (cents == null) cents = 0L;

            var inserted = jdbc.queryForList(
                    "INSERT INTO ifo (codigo, ano, ciclo_id, bloco, natureza, estado, interesse_renovacao, " +
                    "objeto, cadastros_unidades_id, cadastros_areas_id, valor_estimado_cents, " +
                    "created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, 'continuada', 'rascunho', FALSE, " +
                    "?, ?, ?, COALESCE(?, 0), ?, ?) RETURNING id",
                    codigo, asInt(ifoOriginal.get("ano")), cicloId, "encerramento",
                    objectName, asLong(ifoOriginal.get("cadastros_unidades_id")), asLong(ifoOriginal.get("cadastros_areas_id")), cents,
                    userId, userId);

            Long newIfoId = asLong(inserted.get(0).get("id"));

            // Prepara exclusão e inserção em lote (batchUpdate) preservando o motivo
            List<Object[]> deleteBatchArgs = new ArrayList<>();
            List<Object[]> insertBatchArgs = new ArrayList<>();
            for (Map<String, Object> contratoMap : contratosNaoRenovados) {
                Long cid = asLong(contratoMap.get("contract_id"));
                String motivo = str(contratoMap.get("motivo_reclassificacao"));
                deleteBatchArgs.add(new Object[]{ifoId, cid});
                insertBatchArgs.add(new Object[]{newIfoId, cid, false, motivo});
            }
            
            jdbc.batchUpdate("DELETE FROM ifo_contratos WHERE ifo_id = ? AND contract_id = ?", deleteBatchArgs);
            jdbc.batchUpdate("INSERT INTO ifo_contratos (ifo_id, contract_id, interesse_renovacao, motivo_reclassificacao) VALUES (?, ?, ?, ?)", insertBatchArgs);

            // Verifica se o IFO original ficou vazio
            Integer remainingContracts = jdbc.queryForObject("SELECT COUNT(*) FROM ifo_contratos WHERE ifo_id = ?", Integer.class, ifoId);
            if (remainingContracts != null && remainingContracts == 0) {
                jdbc.update("UPDATE ifo SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? WHERE id = ?", userId, ifoId);
            }
        }
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
                "SELECT COUNT(*) FROM ifo WHERE ciclo_id = ? AND cadastros_unidades_id = ? AND estado = 'rascunho' " +
                        "AND validacao <> 'validada_2a'",
                Integer.class, cicloId, unidadeId);
        if (pendentes != null && pendentes > 0) {
            throw new ApiException(409, "Há demandas não validadas em 2ª camada; a partição não pode ser remetida");
        }
        return jdbc.update("UPDATE ifo SET estado = 'enviado_cca', updated_at = NOW(), updated_by = ? " +
                "WHERE ciclo_id = ? AND cadastros_unidades_id = ? AND estado = 'rascunho'", userId, cicloId, unidadeId);
    }

    /** Devolução da partição pela CCA (Autoridade CCA) à área, reabrindo para edição. */
    @Transactional
    public int devolverParticao(long cicloId, long unidadeId, Long userId) {
        papelService.exigirTransicao("cca", cicloId);
        return jdbc.update("UPDATE ifo SET estado = 'rascunho', validacao = 'em_edicao', " +
                "validado_1a_por = NULL, validado_1a_em = NULL, validado_2a_por = NULL, validado_2a_em = NULL, " +
                "updated_at = NOW(), updated_by = ? WHERE ciclo_id = ? AND cadastros_unidades_id = ? AND estado = 'enviado_cca'",
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
        var rows = jdbc.queryForList(
                "SELECT i.*, ca.sigla as area_sigla, ca.nome as area_nome, cu.sigla as unidade_sigla, cu.nome as unidade_nome " +
                "FROM ifo i " +
                "LEFT JOIN cadastros_areas ca ON i.cadastros_areas_id = ca.id " +
                "LEFT JOIN cadastros_unidades cu ON i.cadastros_unidades_id = cu.id " +
                "WHERE i.id = ?", id);
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
                        var optUser = br.jus.tjgo.kaizen.auth.AuthContext.getCurrentUser();
                        boolean isSuperAdmin = optUser.isPresent() && optUser.get().isSuperadmin();
                        if (!isSuperAdmin) {
                            List<String> tagsPermitidas = TAGS_ACESSO_POR_ESTADO.getOrDefault(estado, List.of());
                            List<String> userTags = permissoesAcoesService.buscarTagsDoUsuario(userId);
                            boolean temAcesso = tagsPermitidas.stream().anyMatch(userTags::contains);
                            
                            // Verifica se há delegação (ou herança por transição)
                            if (!temAcesso && cicloId != null) {
                                if (delegacaoEdicaoService.temTagTransicao(estado, userId) || 
                                    delegacaoEdicaoService.tipoDelegacao(cicloId, estado, userId) != null) {
                                    temAcesso = true;
                                }
                            }
                            
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

        StringBuilder sql = new StringBuilder(
                "SELECT i.*, ca.sigla as area_sigla, ca.nome as area_nome, cu.sigla as unidade_sigla, cu.nome as unidade_nome " +
                "FROM ifo i " +
                "LEFT JOIN cadastros_areas ca ON i.cadastros_areas_id = ca.id " +
                "LEFT JOIN cadastros_unidades cu ON i.cadastros_unidades_id = cu.id " +
                "WHERE i.is_deleted = FALSE");
        List<Object> params = new ArrayList<>();
        if (ano != null) {
            sql.append(" AND i.ano = ?");
            params.add(ano);
        }
        if (cicloId != null) {
            sql.append(" AND i.ciclo_id = ?");
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
                    var users = jdbc.queryForList("SELECT cadastros_areas_id FROM users WHERE id = ? LIMIT 1", userId);
                    if (!users.isEmpty() && users.get(0).get("cadastros_areas_id") != null) {
                        Long fetchedAreaId = ((Number) users.get(0).get("cadastros_areas_id")).longValue();
                        if (fetchedAreaId != null) {
                            userAreaIds.add(fetchedAreaId);
                        }
                    }

                } catch (Exception e) {}
            }
            
            if (userAreaIds.isEmpty() && userUnidadeIds.isEmpty()) {
                sql.append(" AND 1 = 0"); // Força retornar vazio se não tiver área
            } else {
                sql.append(" AND (");
                if (!userAreaIds.isEmpty()) {
                    sql.append("i.cadastros_areas_id IN (").append(userAreaIds.stream().map(String::valueOf).collect(Collectors.joining(","))).append(")");
                } else {
                    sql.append("1 = 0");
                }
                sql.append(" OR ");
                if (!userUnidadeIds.isEmpty()) {
                    sql.append("i.cadastros_unidades_id IN (").append(userUnidadeIds.stream().map(String::valueOf).collect(Collectors.joining(","))).append(")");
                } else {
                    sql.append("1 = 0");
                }
                sql.append(")");
            }
        }
        sql.append(" ORDER BY i.codigo");
        return jdbc.queryForList(sql.toString(), params.toArray()).stream().map(this::toDto).toList();
    }

    private void vincularContratos(Long ifoId, List<Long> contratos, Long userId) {
        if (contratos == null) return;
        for (Long contractId : contratos) {
            if (contractId == null) continue;
            Long contractValue = null;
            try {
                contractValue = jdbc.queryForObject("SELECT total_value_cents FROM contracts WHERE id = ?", Long.class, contractId);
            } catch (Exception e) {}
            jdbc.update(
                    "INSERT INTO ifo_contratos (ifo_id, contract_id, valor_contrato_cents) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
                    ifoId, contractId, contractValue);
        }
        recalcularValorIfo(ifoId, userId);
    }

    private void recalcularValorIfo(Long ifoId, Long userId) {
        Number somaNum = jdbc.queryForObject(
                "SELECT SUM(valor_contrato_cents) FROM ifo_contratos WHERE ifo_id = ?",
                Number.class, ifoId);
        if (somaNum != null) {
            jdbc.update("UPDATE ifo SET valor_estimado_cents = ?, updated_at = NOW(), updated_by = ? WHERE id = ?",
                    somaNum.longValue(), userId, ifoId);
        }
    }

    @Transactional
    public IfoDto atualizarValorContrato(long ifoId, long contractId, Long valorCents, Long userId) {
        verificarPermissaoEdicao(ifoId, "MODIFICAR_IFO", userId);
        
        int rows = jdbc.update(
                "UPDATE ifo_contratos SET valor_contrato_cents = ? WHERE ifo_id = ? AND contract_id = ?",
                valorCents, ifoId, contractId);
        
        if (rows == 0) {
            throw new ApiException(404, "Vínculo de contrato não encontrado neste IFO");
        }
        
        recalcularValorIfo(ifoId, userId);
        invalidarPorEdicao(ifoId, userId);
        return get(ifoId);
    }

    private List<Long> contratosDoIfo(long ifoId) {
        return jdbc.query(
                "SELECT contract_id FROM ifo_contratos WHERE ifo_id = ? ORDER BY contract_id",
                (rs, i) -> rs.getLong("contract_id"), ifoId);
    }

    private List<IfoContratoDto> detalhesContratosDoIfo(long ifoId) {
        return jdbc.query(
                "SELECT contract_id, interesse_renovacao, motivo_reclassificacao, valor_contrato_cents FROM ifo_contratos WHERE ifo_id = ? ORDER BY contract_id",
                (rs, i) -> new IfoContratoDto(
                        rs.getLong("contract_id"),
                        rs.getObject("interesse_renovacao") != null ? rs.getBoolean("interesse_renovacao") : true,
                        rs.getString("motivo_reclassificacao"),
                        rs.getObject("valor_contrato_cents") != null ? rs.getLong("valor_contrato_cents") : null
                ), ifoId);
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
                asLong(r.get("cadastros_unidades_id")),
                asLong(r.get("cadastros_areas_id")),
                str(r.get("estado")),
                cents == null ? null : cents / 100.0,
                (Boolean) r.get("interesse_renovacao"),
                (Boolean) r.get("interesse_renovacao_confirmado"),
                str(r.get("motivo_reclassificacao")),
                str(r.get("codigo_oficial")),
                str(r.get("validacao")),
                str(r.get("strategic_objective")),
                (Boolean) r.get("is_sustainable"),
                (Boolean) r.get("is_shared_acquisition"),
                str(r.get("quantity")),
                str(r.get("description")),
                str(r.get("justification")),
                str(r.get("process")),
                str(r.get("financial_resource_type")),
                str(r.get("contract_type")),
                str(r.get("expense_nature")),
                asLong(r.get("formalized_value_cents")),
                str(r.get("priority")),
                r.get("estimated_date") != null ? ((java.sql.Date) r.get("estimated_date")).toLocalDate() : null,
                asLong(r.get("pca_origem_id")),
                str(r.get("area_sigla")),
                str(r.get("area_nome")),
                str(r.get("unidade_sigla")),
                str(r.get("unidade_nome")),
                contratosDoIfo(id),
                detalhesContratosDoIfo(id));
    }

    /**
     * Carrega os PCAs do ano atual (anoFormacao - 1) com contract_type = 'NOVA_CONTRATACAO'
     * e os transforma em IFOs do bloco nova_contratacao. Idempotente: não duplica se já existem
     * IFOs nova_contratacao para o ciclo.
     */
    @Transactional
    public void gerarIfosNovaContratacao(long cicloId, int anoFormacao, Long userId) {
        var check = jdbc.queryForList(
                "SELECT id FROM ifo WHERE ciclo_id = ? AND bloco = 'nova_contratacao' LIMIT 1", cicloId);
        if (!check.isEmpty()) return;

        int anoAtual = anoFormacao - 1;
        String queryPcas = "SELECT id, code, year, description, justification, process, " +
                "estimated_value_cents, formalized_value_cents, cadastros_unidades_id, " +
                "cadastros_areas_id, priority, estimated_date " +
                "FROM pcas " +
                "WHERE year = ? AND contract_type = 'NOVA_CONTRATACAO' " +
                "AND (is_deleted = FALSE OR is_deleted IS NULL) " +
                "ORDER BY code";

        List<Map<String, Object>> pcas = jdbc.queryForList(queryPcas, String.valueOf(anoAtual));

        for (Map<String, Object> pca : pcas) {
            String codigo = gerarCodigo(anoFormacao);
            Long areaId = asLong(pca.get("cadastros_areas_id"));
            Long unidadeId = asLong(pca.get("cadastros_unidades_id"));
            String areaDemandanteText = str(pca.get("directory_acronym"));

            // Fallback: resolver area_demandante pela tabela cadastros_areas
            if (areaId != null) {
                var resArea = jdbc.queryForList("SELECT sigla FROM cadastros_areas WHERE id = ?", areaId);
                if (!resArea.isEmpty() && resArea.get(0).get("sigla") != null) {
                    areaDemandanteText = str(resArea.get(0).get("sigla"));
                }
            }

            // Fallback para unidade_id via cadastros_unidades
            if (unidadeId == null && areaDemandanteText != null) {
                var res = jdbc.queryForList(
                        "SELECT id FROM cadastros_unidades WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) " +
                        "OR LOWER(TRIM(nome)) = LOWER(TRIM(?)) LIMIT 1",
                        areaDemandanteText, areaDemandanteText);
                if (!res.isEmpty()) unidadeId = asLong(res.get(0).get("id"));
            }

            var inserted = jdbc.queryForList(
                    "INSERT INTO ifo (codigo, ano, ciclo_id, bloco, natureza, estado, " +
                    "objeto, cadastros_unidades_id, cadastros_areas_id, valor_estimado_cents, " +
                    "description, justification, process, financial_resource_type, contract_type, " +
                    "formalized_value_cents, priority, estimated_date, " +
                    "pca_origem_id, created_by, updated_by) " +
                    "VALUES (?, ?, ?, 'nova_contratacao', 'pontual', 'rascunho', " +
                    "?, ?, ?, COALESCE(?, 0), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                    codigo, anoFormacao, cicloId,
                    str(pca.get("object_name")), unidadeId, areaId, asLong(pca.get("estimated_value_cents")),
                    str(pca.get("description")), str(pca.get("justification")),
                    str(pca.get("process")), str(pca.get("financial_resource_type")),
                    str(pca.get("contract_type")), asLong(pca.get("formalized_value_cents")),
                    str(pca.get("priority")), pca.get("estimated_date"),
                    asLong(pca.get("id")), userId, userId);

            Long ifoId = asLong(inserted.get(0).get("id"));

            // Copiar contratos vinculados ao PCA para ifo_contratos
            List<Map<String, Object>> contratos = jdbc.queryForList(
                    "SELECT contract_id FROM contracts_pcas WHERE pca_id = ?",
                    asLong(pca.get("id")));
            for (Map<String, Object> c : contratos) {
                jdbc.update(
                        "INSERT INTO ifo_contratos (ifo_id, contract_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                        ifoId, asLong(c.get("contract_id")));
            }
        }
    }

    @Transactional
    public void gerarIfosRenovacao(long cicloId, int anoFormacao, Long userId) {
        var check = jdbc.queryForList("SELECT id FROM ifo WHERE ciclo_id = ? AND bloco = 'renovacao' LIMIT 1", cicloId);
        if (!check.isEmpty()) return;

        String queryContratos = "SELECT c.id as contract_id, c.object_name, c.total_value_cents, " +
                "c.cadastros_unidades_id, c.cadastros_areas_id, cp.pca_id, " +
                "c.start_date, c.limit_date, c.end_date, COALESCE(c.year_duration_standard, 10) as year_duration_standard " +
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
            java.sql.Date sqlEndDate = (java.sql.Date) c.get("end_date");
            
            if (sqlStartDate != null && sqlLimitDate != null && sqlEndDate != null) {
                int startYear = sqlStartDate.toLocalDate().getYear();
                int limitYear = sqlLimitDate.toLocalDate().getYear();
                int endYear = sqlEndDate.toLocalDate().getYear();
                int duration = ((Number) c.get("year_duration_standard")).intValue();
            /**  
                if (limitYear > anoFormacao + 2) {
                    bloco = "plurianual";
                }
                else if (limitYear <= anoFormacao+1) {
                    bloco = "encerramento";
                }
                else if (startYear + duration >= anoFormacao + 1) {
                    bloco = "renovacao";
                }
            }
             */
                if (endYear >= anoFormacao + 1) {
                    bloco = "plurianual";
                } 
                else if (limitYear <= anoFormacao) {
                    bloco = "encerramento";
                } 
                else if (endYear <= anoFormacao && limitYear > anoFormacao) {
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
                    "SELECT object_name, estimated_value_cents, cadastros_unidades_id, " +
                    "cadastros_areas_id, priority, description, justification, " +
                    "process, financial_resource_type, contract_type, formalized_value_cents " +
                    "FROM pcas WHERE id = ?", pcaId);

            if (pcaRows.isEmpty()) continue;
            Map<String, Object> pca = pcaRows.get(0);
            
            for (Map.Entry<String, List<Map<String, Object>>> blocoEntry : pcaEntry.getValue().entrySet()) {
                String bloco = blocoEntry.getKey();
                List<Map<String, Object>> contratosDoPca = blocoEntry.getValue();

                String codigo = gerarCodigo(anoFormacao);

                Long areaId = asLong(pca.get("cadastros_areas_id"));
                Long unidadeId = asLong(pca.get("cadastros_unidades_id"));
                
                if (areaId == null || unidadeId == null) {
                    Map<String, Object> firstContract = contratosDoPca.isEmpty() ? null : contratosDoPca.get(0);
                    if (firstContract != null) {
                        if (areaId == null) areaId = asLong(firstContract.get("cadastros_areas_id"));
                        if (unidadeId == null) unidadeId = asLong(firstContract.get("cadastros_unidades_id"));
                    }
                }

                var inserted = jdbc.queryForList(
                        "INSERT INTO ifo (codigo, ano, ciclo_id, bloco, natureza, estado, interesse_renovacao, " +
                        "objeto, cadastros_unidades_id, cadastros_areas_id, valor_estimado_cents, " +
                        "description, justification, process, financial_resource_type, contract_type, " +
                        "formalized_value_cents, priority, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, 'continuada', 'rascunho', TRUE, " +
                        "?, ?, ?, COALESCE(?, 0), ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                        codigo, anoFormacao, cicloId, bloco,
                        str(pca.get("object_name")), unidadeId, areaId,
                        asLong(pca.get("estimated_value_cents")),
                        str(pca.get("description")), str(pca.get("justification")), str(pca.get("process")),
                        str(pca.get("financial_resource_type")), str(pca.get("contract_type")),
                        asLong(pca.get("formalized_value_cents")), str(pca.get("priority")), userId, userId);

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
            Long unidadeId = asLong(c.get("cadastros_unidades_id"));
            Long areaId = asLong(c.get("cadastros_areas_id"));

            var inserted = jdbc.queryForList(
                    "INSERT INTO ifo (codigo, ano, ciclo_id, bloco, natureza, estado, interesse_renovacao, " +
                    "objeto, cadastros_unidades_id, cadastros_areas_id, valor_estimado_cents, " +
                    "created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, 'continuada', 'rascunho', TRUE, " +
                    "?, ?, ?, COALESCE(?, 0), ?, ?) RETURNING id",
                    codigo, anoFormacao, cicloId, bloco,
                    str(c.get("object_name")), unidadeId, areaId, asLong(c.get("total_value_cents")),
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
