package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.dto.DfdConsultaDto;
import br.jus.tjgo.kaizen.dto.DfdItemDto;
import br.jus.tjgo.kaizen.dto.DfdPcaItemDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * DFD-Consulta (Cap. 1) — monta o instrumento de captura da Formação classificando os contratos
 * de natureza continuada da unidade por ciclo de vida (RF-01/02) e pré-preenchendo o Bloco 4 com
 * os itens do PCA-TIC corrente (RF-03/04).
 *
 * A classificação em blocos é DERIVADA (não persistida em `situation`): comparada a vigência do
 * contrato (`end_date`) e a data-limite de prorrogação (`limit_date`) contra o exercício-alvo.
 * A persistência do IFO (banda-envelope) e o envio à CCA são a próxima etapa (RF-05.1/24/26).
 */
@Service
@RequiredArgsConstructor
public class DfdConsultaService {

    private final JdbcTemplate jdbc;
    private final PcaService pcaService;

    private static final String SELECT_CONTRATOS_CONTINUADA =
            "SELECT id, process, supplier, object_name, unidade, situation, " +
                    "start_date, end_date, limit_date, total_value_cents " +
                    "FROM contracts " +
                    "WHERE (is_deleted = FALSE OR is_deleted IS NULL) AND situation = 'continuada' ";

    public DfdConsultaDto montarConsulta(int ano, Long cadastroUnidadeId) {
        StringBuilder sql = new StringBuilder(SELECT_CONTRATOS_CONTINUADA);
        List<Object> params = new ArrayList<>();
        if (cadastroUnidadeId != null) {
            sql.append("AND cadastro_unidade_id = ? ");
            params.add(cadastroUnidadeId);
        }
        sql.append("ORDER BY end_date NULLS LAST, id");
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), params.toArray());

        List<DfdItemDto> encerramento = new ArrayList<>();
        List<DfdItemDto> renovacao = new ArrayList<>();
        List<DfdItemDto> plurianual = new ArrayList<>();

        for (Map<String, Object> r : rows) {
            LocalDate fim = asDate(r.get("end_date"));
            LocalDate limite = asDate(r.get("limit_date"));
            String bloco = classificar(ano, fim, limite);
            DfdItemDto item = toItem(r, bloco);
            switch (bloco) {
                case "renovacao" -> renovacao.add(item);
                case "plurianual" -> plurianual.add(item);
                default -> encerramento.add(item);
            }
        }

        List<DfdPcaItemDto> novaContratacao = pcaService.findAll(ano, null, null).stream()
                .map(this::toPcaItem)
                .toList();

        return new DfdConsultaDto(ano, cadastroUnidadeId, encerramento, renovacao, plurianual, novaContratacao);
    }

    /**
     * RF-02 — ciclo de vida do contrato continuada relativo ao exercício-alvo:
     *  - vigência ultrapassa o exercício (fim.ano > ano) → PLURIANUAL (segue vigente, sem ação);
     *  - encerra no/até o exercício e ainda há prazo de prorrogação (limite > fim) → RENOVAÇÃO;
     *  - encerra no/até o exercício sem prazo de prorrogação → ENCERRAMENTO (exige nova contratação).
     */
    private String classificar(int ano, LocalDate fim, LocalDate limite) {
        if (fim == null) {
            return "plurianual";
        }
        if (fim.getYear() > ano) {
            return "plurianual";
        }
        if (limite != null && limite.isAfter(fim)) {
            return "renovacao";
        }
        return "encerramento";
    }

    private DfdItemDto toItem(Map<String, Object> r, String bloco) {
        Long cents = asLong(r.get("total_value_cents"));
        return new DfdItemDto(
                asLong(r.get("id")),
                str(r.get("process")),
                str(r.get("supplier")),
                str(r.get("object_name")),
                str(r.get("unidade")),
                str(r.get("situation")),
                bloco,
                str(r.get("start_date")),
                str(r.get("end_date")),
                str(r.get("limit_date")),
                cents == null ? null : cents / 100.0);
    }

    private DfdPcaItemDto toPcaItem(Map<String, Object> r) {
        return new DfdPcaItemDto(
                asLong(r.get("id")),
                str(r.get("item_pca")),
                str(r.get("objeto")),
                str(r.get("area_demandante")),
                asDouble(r.get("valor_estimado")));
    }

    private static LocalDate asDate(Object v) {
        if (v == null) return null;
        if (v instanceof java.sql.Date d) return d.toLocalDate();
        if (v instanceof LocalDate d) return d;
        try {
            return LocalDate.parse(String.valueOf(v).substring(0, 10));
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static Long asLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }

    private static Double asDouble(Object v) {
        return v == null ? null : ((Number) v).doubleValue();
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
