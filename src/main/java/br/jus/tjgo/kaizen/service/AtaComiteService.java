package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Juntada das atas dos comitês (CGTIC/CGOVTIC) — RN-GERAL-04. O Kaizen reflete o ato externo
 * (deliberação no PROAD) pela inclusão do registro/anexo da ata. Ação do escopo SGJT (Editor SGJT
 * junta; Secretário SGJT é a Autoridade) — validada em {@link OrcamentoPapelService#exigirEdicao}.
 */
@Service
@RequiredArgsConstructor
public class AtaComiteService {

    private final JdbcTemplate jdbc;
    private final OrcamentoPapelService papelService;

    private static final List<String> COMITES = List.of("cgtic", "cgovtic");

    @Transactional
    public Map<String, Object> registrar(Long cicloId, String comite, String numero, String dataAta,
                                         String decisao, String anexoUrl, Long userId) {
        papelService.exigirEdicao("sgjt", cicloId);
        String c = comite == null ? "" : comite.trim().toLowerCase();
        if (!COMITES.contains(c)) {
            throw new ApiException(400, "Comitê inválido (use cgtic ou cgovtic)");
        }
        var rows = jdbc.queryForList(
                "INSERT INTO atas_comites (ciclo_id, comite, numero, data_ata, decisao, anexo_url, created_by) " +
                        "VALUES (?, ?, ?, CAST(? AS DATE), ?, ?, ?) RETURNING *",
                cicloId, c, numero, (dataAta == null || dataAta.isBlank()) ? null : dataAta, decisao, anexoUrl, userId);
        return rows.get(0);
    }

    public List<Map<String, Object>> listar(Long cicloId) {
        if (cicloId == null) {
            return jdbc.queryForList("SELECT * FROM atas_comites ORDER BY id DESC");
        }
        return jdbc.queryForList("SELECT * FROM atas_comites WHERE ciclo_id = ? ORDER BY id DESC", cicloId);
    }

    @Transactional
    public void excluir(long id) {
        var rows = jdbc.queryForList("SELECT ciclo_id FROM atas_comites WHERE id = ?", id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "Ata não encontrada");
        }
        Long cicloId = rows.get(0).get("ciclo_id") == null ? null : ((Number) rows.get(0).get("ciclo_id")).longValue();
        papelService.exigirEdicao("sgjt", cicloId);
        jdbc.update("DELETE FROM atas_comites WHERE id = ?", id);
    }
}
