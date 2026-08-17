package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.MonthDay;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

/**
 * CRUD e validação dos parâmetros do Ciclo Orçamentário (Contratações de TIC).
 * Lê das tabelas normalizadas parametros_ciclo_formacao, parametros_ciclo_revisao
 * e parametros_ciclo_geral. O acesso de escrita é restrito a usuários com is_developer = true.
 */
@Service
@RequiredArgsConstructor
public class ParametrosCicloService {

    private final JdbcTemplate jdbc;

    // ==================== FASES DA FORMAÇÃO ====================

    public List<Map<String, Object>> getFasesFormacao() {
        return jdbc.queryForList(
                "SELECT * FROM parametros_ciclo_formacao ORDER BY ordem");
    }

    @Transactional
    public List<Map<String, Object>> salvarFasesFormacao(List<Map<String, Object>> fases, Long userId) {
        validarFasesFormacao(fases);
        for (Map<String, Object> fase : fases) {
            jdbc.update(
                    "INSERT INTO parametros_ciclo_formacao (ordem, fase, area, data_limite, updated_at, updated_by) " +
                            "VALUES (?, ?, ?, ?, NOW(), ?) " +
                            "ON CONFLICT (ordem) DO UPDATE SET " +
                            "fase = EXCLUDED.fase, area = EXCLUDED.area, data_limite = EXCLUDED.data_limite, " +
                            "updated_at = NOW(), updated_by = EXCLUDED.updated_by",
                    toInt(fase.get("ordem")),
                    fase.get("fase"),
                    fase.get("area"),
                    fase.get("data_limite"),
                    userId);
        }
        return getFasesFormacao();
    }

    private void validarFasesFormacao(List<Map<String, Object>> fases) {
        if (fases == null || fases.isEmpty()) {
            throw new ApiException(400, "Pelo menos uma fase é obrigatória");
        }
        MonthDay anterior = null;
        for (int i = 0; i < fases.size(); i++) {
            Map<String, Object> f = fases.get(i);
            String data = (String) f.get("data_limite");
            if (data == null || data.isBlank()) {
                throw new ApiException(400, "Data-limite é obrigatória na fase " + (i + 1));
            }
            MonthDay md = parseMonthDay(data, "fase " + (i + 1));
            if (anterior != null && md.isBefore(anterior)) {
                throw new ApiException(400,
                        "As datas da Formação devem ser cronológicas. A fase " + (i + 1) +
                                " (" + data + ") não pode ser anterior à fase anterior.");
            }
            anterior = md;
        }
    }

    // ==================== JANELAS DE REVISÃO ====================

    public List<Map<String, Object>> getJanelasRevisao() {
        return jdbc.queryForList(
                "SELECT * FROM parametros_ciclo_revisao ORDER BY ordem");
    }

    @Transactional
    public List<Map<String, Object>> salvarJanelasRevisao(List<Map<String, Object>> janelas, Long userId) {
        validarJanelasRevisao(janelas);
        for (Map<String, Object> j : janelas) {
            jdbc.update(
                    "INSERT INTO parametros_ciclo_revisao (ordem, versao, janela_inicio, janela_fim, rito_sgjt, comites, remessa_dg, updated_at, updated_by) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?) " +
                            "ON CONFLICT (ordem) DO UPDATE SET " +
                            "versao = EXCLUDED.versao, janela_inicio = EXCLUDED.janela_inicio, janela_fim = EXCLUDED.janela_fim, " +
                            "rito_sgjt = EXCLUDED.rito_sgjt, comites = EXCLUDED.comites, remessa_dg = EXCLUDED.remessa_dg, " +
                            "updated_at = NOW(), updated_by = EXCLUDED.updated_by",
                    toInt(j.get("ordem")),
                    toInt(j.get("versao")),
                    j.get("janela_inicio"),
                    j.get("janela_fim"),
                    j.get("rito_sgjt"),
                    j.get("comites"),
                    j.get("remessa_dg"),
                    userId);
        }
        return getJanelasRevisao();
    }

    private void validarJanelasRevisao(List<Map<String, Object>> janelas) {
        if (janelas == null || janelas.isEmpty()) {
            throw new ApiException(400, "Pelo menos uma janela de revisão é obrigatória");
        }
        MonthDay fimAnterior = null;
        for (int i = 0; i < janelas.size(); i++) {
            Map<String, Object> j = janelas.get(i);
            String inicio = (String) j.get("janela_inicio");
            String fim = (String) j.get("janela_fim");
            String sgjt = (String) j.get("rito_sgjt");
            String comites = (String) j.get("comites");
            String remDg = (String) j.get("remessa_dg");

            if (fim == null || fim.isBlank()) {
                throw new ApiException(400, "Data de fim da janela é obrigatória na janela " + (i + 1));
            }
            if (sgjt == null || sgjt.isBlank()) {
                throw new ApiException(400, "Data do rito SGJT é obrigatória na janela " + (i + 1));
            }
            if (comites == null || comites.isBlank()) {
                throw new ApiException(400, "Data de comitês é obrigatória na janela " + (i + 1));
            }
            if (remDg == null || remDg.isBlank()) {
                throw new ApiException(400, "Data de remessa DG é obrigatória na janela " + (i + 1));
            }

            MonthDay mdFim = parseMonthDay(fim, "janela " + (i + 1) + " (fim)");
            MonthDay mdSgjt = parseMonthDay(sgjt, "janela " + (i + 1) + " (rito SGJT)");
            MonthDay mdComites = parseMonthDay(comites, "janela " + (i + 1) + " (comitês)");
            MonthDay mdRemDg = parseMonthDay(remDg, "janela " + (i + 1) + " (remessa DG)");

            // Início pode ser null na 1ª janela (abre por evento de publicação)
            if (inicio != null && !inicio.isBlank()) {
                MonthDay mdInicio = parseMonthDay(inicio, "janela " + (i + 1) + " (início)");
                if (mdFim.isBefore(mdInicio)) {
                    throw new ApiException(400,
                            "Na janela " + (i + 1) + ", o fim (" + fim + ") deve ser posterior ou igual ao início (" + inicio + ").");
                }
            }

            // Rito deve ser cronológico: fim <= sgjt <= comites <= remessaDg
            if (mdSgjt.isBefore(mdFim)) {
                throw new ApiException(400,
                        "Na janela " + (i + 1) + ", o rito SGJT (" + sgjt + ") deve ser posterior ou igual ao fim da janela (" + fim + ").");
            }
            if (mdComites.isBefore(mdSgjt)) {
                throw new ApiException(400,
                        "Na janela " + (i + 1) + ", a data de comitês (" + comites + ") deve ser posterior ou igual ao rito SGJT (" + sgjt + ").");
            }
            if (mdRemDg.isBefore(mdComites)) {
                throw new ApiException(400,
                        "Na janela " + (i + 1) + ", a remessa DG (" + remDg + ") deve ser posterior ou igual à data de comitês (" + comites + ").");
            }

            // Não pode se sobrepor à janela anterior
            if (fimAnterior != null && inicio != null && !inicio.isBlank()) {
                MonthDay mdInicio = parseMonthDay(inicio, "janela " + (i + 1));
                if (mdInicio.isBefore(fimAnterior)) {
                    throw new ApiException(400,
                            "As janelas de revisão não podem se sobrepor. A janela " + (i + 1) +
                                    " inicia antes do término da janela anterior.");
                }
            }
            fimAnterior = mdFim;
        }
    }

    // ==================== PARÂMETROS GERAIS ====================

    public List<Map<String, Object>> getParametrosGerais() {
        return jdbc.queryForList(
                "SELECT * FROM parametros_ciclo_geral ORDER BY chave");
    }

    @Transactional
    public Map<String, Object> salvarParametroGeral(String chave, String valor, Long userId) {
        if (chave == null || chave.isBlank()) {
            throw new ApiException(400, "Chave é obrigatória");
        }
        if (valor == null || valor.isBlank()) {
            throw new ApiException(400, "Valor é obrigatório");
        }

        // Validações específicas por chave
        if ("corte_formacao".equals(chave)) {
            parseMonthDay(valor, "corte de formação");
        }

        var rows = jdbc.queryForList(
                "UPDATE parametros_ciclo_geral SET valor = ?, updated_at = NOW(), updated_by = ? " +
                        "WHERE chave = ? RETURNING *",
                valor, userId, chave);
        if (rows.isEmpty()) {
            rows = jdbc.queryForList(
                    "INSERT INTO parametros_ciclo_geral (chave, valor, updated_at, updated_by) " +
                            "VALUES (?, ?, NOW(), ?) RETURNING *",
                    chave, valor, userId);
        }
        return rows.get(0);
    }

    // ==================== RESOLUÇÃO PARA CicloOrcamentarioService ====================

    /**
     * Retorna o corte de formação parametrizado como MonthDay.
     * Fallback para 01/03 se não houver registro.
     */
    public MonthDay getCorteFormacao() {
        var rows = jdbc.queryForList(
                "SELECT valor FROM parametros_ciclo_geral WHERE chave = 'corte_formacao'");
        if (rows.isEmpty()) {
            return MonthDay.of(3, 1); // fallback padrão
        }
        return parseMonthDay((String) rows.get(0).get("valor"), "corte_formacao");
    }

    /**
     * Retorna as janelas de revisão como records internos para uso pelo CicloOrcamentarioService.
     * Fallback para os valores padrão hardcoded se a tabela estiver vazia.
     */
    public List<JanelaParam> getJanelasRevisaoParam() {
        var rows = getJanelasRevisao();
        if (rows.isEmpty()) {
            // Fallback para valores padrão
            return List.of(
                    new JanelaParam(1, 2, null, MonthDay.of(1, 31)),
                    new JanelaParam(2, 3, MonthDay.of(4, 1), MonthDay.of(4, 30)),
                    new JanelaParam(3, 4, MonthDay.of(7, 1), MonthDay.of(7, 31)));
        }
        return rows.stream().map(r -> {
            String inicio = (String) r.get("janela_inicio");
            String fim = (String) r.get("janela_fim");
            return new JanelaParam(
                    ((Number) r.get("ordem")).intValue(),
                    ((Number) r.get("versao")).intValue(),
                    inicio != null && !inicio.isBlank() ? parseMonthDay(inicio, "janela") : null,
                    parseMonthDay(fim, "janela"));
        }).toList();
    }

    /** Record exposto para consumo pelo CicloOrcamentarioService. */
    public record JanelaParam(int ordem, int versao, MonthDay inicio, MonthDay fim) {}

    // ==================== UTILITÁRIOS ====================

    /**
     * Converte DD/MM para MonthDay. Aceita formatos "DD/MM".
     */
    static MonthDay parseMonthDay(String ddmm, String contexto) {
        if (ddmm == null || ddmm.isBlank()) {
            throw new ApiException(400, "Data inválida (vazia) no contexto: " + contexto);
        }
        String[] parts = ddmm.trim().split("/");
        if (parts.length != 2) {
            throw new ApiException(400, "Data '" + ddmm + "' deve estar no formato DD/MM (contexto: " + contexto + ")");
        }
        try {
            int day = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]);
            return MonthDay.of(month, day);
        } catch (NumberFormatException | DateTimeParseException e) {
            throw new ApiException(400, "Data '" + ddmm + "' inválida no contexto: " + contexto);
        }
    }

    private static int toInt(Object o) {
        if (o == null) {
            throw new ApiException(400, "Atributo numérico obrigatório ausente.");
        }
        if (o instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(o));
        } catch (NumberFormatException e) {
            throw new ApiException(400, "Valor numérico inválido: " + o);
        }
    }
}
