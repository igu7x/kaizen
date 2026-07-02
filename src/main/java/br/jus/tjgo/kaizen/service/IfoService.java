package br.jus.tjgo.kaizen.service;

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

/**
 * IFO (Item de Formação do Orçamento) — cria e consulta as bandas-envelope da Formação. O código
 * IFO-{ano}-{NNNN} é gerado sequencialmente por ano (RF-49). O IFO agrupa 1:N contratos continuada
 * da DFD-Consulta (RF-10/11) e é enviado à CCA (RF-24/26). Na publicação vira código oficial de PCA.
 */
@Service
@RequiredArgsConstructor
public class IfoService {

    private final JdbcTemplate jdbc;

    // Domínios validados aqui no backend — os CHECK foram removidos do banco (migration 172).
    private static final List<String> BLOCOS =
            List.of("encerramento", "renovacao", "plurianual", "nova_contratacao");

    private static final List<String> NATUREZAS = List.of("continuada", "pontual");

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
                        "unidade_id, estado, valor_estimado_cents, interesse_renovacao, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rascunho', ?, ?, ?, ?) RETURNING *",
                codigo, req.ano(), req.cicloId(), req.bloco(), req.natureza(), req.objeto(),
                req.areaDemandante(), req.unidadeId(), cents, req.interesseRenovacao(), userId, userId);

        Long ifoId = asLong(rows.get(0).get("id"));
        vincularContratos(ifoId, req.contratos());
        return get(ifoId);
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
                "SELECT id FROM ifo WHERE ano = ? AND estado <> 'publicado' ORDER BY codigo", ano);
        if (ifos.isEmpty()) return 0;
        Integer base = jdbc.queryForObject(
                "SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) " +
                        "FROM pcas WHERE year = ?",
                Integer.class, String.valueOf(ano));
        int prox = (base == null ? 0 : base) + 1;
        for (Map<String, Object> row : ifos) {
            Long id = asLong(row.get("id"));
            jdbc.update(
                    "UPDATE ifo SET codigo_oficial = ?, estado = 'publicado', updated_at = NOW(), updated_by = ? WHERE id = ?",
                    String.valueOf(prox), userId, id);
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
                    "UPDATE ifo SET interesse_renovacao = TRUE, bloco = 'renovacao', motivo_reclassificacao = NULL, " +
                            "updated_at = NOW(), updated_by = ? WHERE id = ?",
                    userId, id);
        } else {
            String m = (motivo == null || motivo.isBlank()) ? "Sem interesse na renovação" : motivo.trim();
            jdbc.update(
                    "UPDATE ifo SET interesse_renovacao = FALSE, bloco = 'encerramento', motivo_reclassificacao = ?, " +
                            "updated_at = NOW(), updated_by = ? WHERE id = ?",
                    m, userId, id);
        }
        return get(id);
    }

    @Transactional
    public void excluir(long id) {
        int n = jdbc.update("DELETE FROM ifo WHERE id = ? AND estado = 'rascunho'", id);
        if (n == 0) {
            throw new ApiException(400, "IFO não encontrado ou já enviado (não pode ser excluído)");
        }
    }

    public IfoDto get(long id) {
        var rows = jdbc.queryForList("SELECT * FROM ifo WHERE id = ?", id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "IFO não encontrado");
        }
        return toDto(rows.get(0));
    }

    public List<IfoDto> listar(Integer ano, Long cicloId) {
        StringBuilder sql = new StringBuilder("SELECT * FROM ifo WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (ano != null) {
            sql.append(" AND ano = ?");
            params.add(ano);
        }
        if (cicloId != null) {
            sql.append(" AND ciclo_id = ?");
            params.add(cicloId);
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
                str(r.get("estado")),
                cents == null ? null : cents / 100.0,
                (Boolean) r.get("interesse_renovacao"),
                str(r.get("motivo_reclassificacao")),
                str(r.get("codigo_oficial")),
                contratosDoIfo(id));
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
