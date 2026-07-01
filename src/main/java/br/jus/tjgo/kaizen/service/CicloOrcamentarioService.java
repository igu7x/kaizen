package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.dto.CicloDto;
import br.jus.tjgo.kaizen.dto.EntradaCicloDto;
import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.MonthDay;
import java.util.List;
import java.util.Map;

/**
 * Fundação do Ciclo Orçamentário (Orçamento de TIC). Produz versões oficiais do PCA-TIC por
 * finalidade: Formação (Versão 1 do ano seguinte) e Revisão (Versões 2–4 do ano vigente).
 * A esteira detalhada (transições por estado×papel) e a integração da publicação com o snapshot
 * de PCA (RF-41/75) e o IFO serão evoluídas em cima desta base.
 */
@Service
@RequiredArgsConstructor
public class CicloOrcamentarioService {

    private final JdbcTemplate jdbc;
    private final PcaService pcaService;

    private static final String ESTADO_FORMACAO_INICIAL = "aberto_aguardando_proad";
    private static final String ESTADO_REVISAO_JANELA = "janela_aberta";

    /** RF-76 — janelas ordinárias (início, fim, versão gerada). A 1ª abre pelo evento de publicação. */
    private record Janela(int ordem, int versao, MonthDay inicio, MonthDay fim) {}

    private static final List<Janela> JANELAS = List.of(
            new Janela(1, 2, null, MonthDay.of(1, 31)),
            new Janela(2, 3, MonthDay.of(4, 1), MonthDay.of(4, 30)),
            new Janela(3, 4, MonthDay.of(7, 1), MonthDay.of(7, 31)));

    private static Janela janelaAtiva(LocalDate hoje) {
        MonthDay hm = MonthDay.of(hoje.getMonthValue(), hoje.getDayOfMonth());
        for (Janela j : JANELAS) {
            if (j.inicio() == null) continue;
            if (!hm.isBefore(j.inicio()) && !hm.isAfter(j.fim())) {
                return j;
            }
        }
        return null;
    }

    // ---------- consultas ----------

    public CicloDto getCiclo(long id) {
        var rows = jdbc.queryForList("SELECT * FROM ciclo_orcamentario WHERE id = ?", id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "Ciclo não encontrado");
        }
        return toDto(rows.get(0));
    }

    private CicloDto findCicloMaisRecente(int ano, String finalidade) {
        var rows = jdbc.queryForList(
                "SELECT * FROM ciclo_orcamentario WHERE ano = ? AND finalidade = ? ORDER BY id DESC LIMIT 1",
                ano, finalidade);
        return rows.isEmpty() ? null : toDto(rows.get(0));
    }

    public EntradaCicloDto getEntrada(int anoVigente) {
        int anoFormacao = anoVigente + 1;
        CicloDto formacao = findCicloMaisRecente(anoFormacao, "formacao");
        CicloDto revisao = findCicloMaisRecente(anoVigente, "revisao");
        Janela ativa = janelaAtiva(LocalDate.now());
        return new EntradaCicloDto(
                anoFormacao,
                formacao,
                anoVigente,
                ativa != null ? ativa.ordem() : null,
                ativa != null ? ativa.versao() : null,
                revisao);
    }

    // ---------- ações ----------

    @Transactional
    public CicloDto getOuAbrirFormacao(int anoFormacao, Long userId) {
        CicloDto existente = findCicloMaisRecente(anoFormacao, "formacao");
        if (existente != null) {
            return existente;
        }
        var rows = jdbc.queryForList(
                "INSERT INTO ciclo_orcamentario (ano, finalidade, estado, versao_gerada, abertura_em, created_by, updated_by) " +
                        "VALUES (?, 'formacao', ?, 1, NOW(), ?, ?) RETURNING *",
                anoFormacao, ESTADO_FORMACAO_INICIAL, userId, userId);
        return toDto(rows.get(0));
    }

    @Transactional
    public CicloDto informarProad(long id, String proad, Long userId) {
        if (proad == null || proad.isBlank()) {
            throw new ApiException(400, "PROAD é obrigatório");
        }
        var rows = jdbc.queryForList(
                "UPDATE ciclo_orcamentario SET proad = ?, estado = 'em_consulta', updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ? AND finalidade = 'formacao' RETURNING *",
                proad.trim(), userId, id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "Ciclo de formação não encontrado");
        }
        return toDto(rows.get(0));
    }

    @Transactional
    public CicloDto getOuAbrirRevisao(int anoVigente, Long userId) {
        var abertos = jdbc.queryForList(
                "SELECT * FROM ciclo_orcamentario WHERE ano = ? AND finalidade = 'revisao' AND estado <> 'publicado' " +
                        "ORDER BY id DESC LIMIT 1",
                anoVigente);
        if (!abertos.isEmpty()) {
            return toDto(abertos.get(0));
        }
        Janela ativa = janelaAtiva(LocalDate.now());
        if (ativa == null) {
            throw new ApiException(409, "Nenhuma janela de revisão ativa no momento");
        }
        var rows = jdbc.queryForList(
                "INSERT INTO ciclo_orcamentario (ano, finalidade, subtipo, estado, versao_gerada, abertura_em, created_by, updated_by) " +
                        "VALUES (?, 'revisao', 'ordinaria', ?, ?, NOW(), ?, ?) RETURNING *",
                anoVigente, ESTADO_REVISAO_JANELA, ativa.versao(), userId, userId);
        return toDto(rows.get(0));
    }

    @Transactional
    public CicloDto abrirRevisaoExtraordinaria(int anoVigente, Long userId) {
        // RF-74: uma revisão não publicada por vez sobre o mesmo PCA-TIC{ano} (garantido pelo índice único).
        Integer maxVersao = jdbc.queryForObject(
                "SELECT COALESCE(MAX(versao_gerada), 1) FROM ciclo_orcamentario WHERE ano = ? AND finalidade = 'revisao'",
                Integer.class, anoVigente);
        int proximaVersao = (maxVersao == null ? 2 : maxVersao + 1);
        var rows = jdbc.queryForList(
                "INSERT INTO ciclo_orcamentario (ano, finalidade, subtipo, estado, versao_gerada, abertura_em, created_by, updated_by) " +
                        "VALUES (?, 'revisao', 'extraordinaria', ?, ?, NOW(), ?, ?) RETURNING *",
                anoVigente, ESTADO_REVISAO_JANELA, proximaVersao, userId, userId);
        return toDto(rows.get(0));
    }

    @Transactional
    public CicloDto atualizarEstado(long id, String estado, Long userId) {
        if (estado == null || estado.isBlank()) {
            throw new ApiException(400, "Estado é obrigatório");
        }
        var rows = jdbc.queryForList(
                "UPDATE ciclo_orcamentario SET estado = ?, updated_at = NOW(), updated_by = ? WHERE id = ? RETURNING *",
                estado.trim(), userId, id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "Ciclo não encontrado");
        }
        return toDto(rows.get(0));
    }

    @Transactional
    public CicloDto publicar(long id, Long userId) {
        var rows = jdbc.queryForList(
                "UPDATE ciclo_orcamentario SET estado = 'publicado', publicado_em = NOW(), updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ? AND estado <> 'publicado' RETURNING *",
                userId, id);
        if (rows.isEmpty()) {
            throw new ApiException(400, "Ciclo não encontrado ou já publicado");
        }
        CicloDto ciclo = toDto(rows.get(0));
        // RF-41/75 — a publicação pela DG grava a próxima versão do PCA-TIC (snapshot imutável)
        // do ano do ciclo (Formação = Versão 1 do ano seguinte; Revisão = próxima versão do vigente).
        if (ciclo.ano() != null) {
            pcaService.createSnapshot(ciclo.ano(), userId);
        }
        // TODO (evolução): converter IFO -> código oficial de Item de PCA na publicação (RF-49).
        return ciclo;
    }

    // ---------- mapper ----------

    private CicloDto toDto(Map<String, Object> r) {
        return new CicloDto(
                asLong(r.get("id")),
                asInt(r.get("ano")),
                str(r.get("finalidade")),
                str(r.get("subtipo")),
                str(r.get("estado")),
                str(r.get("proad")),
                asInt(r.get("versao_gerada")),
                str(r.get("abertura_em")),
                str(r.get("publicado_em")));
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
