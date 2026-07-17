package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Porte fiel de permissoes.service.ts. */
@Service
@RequiredArgsConstructor
public class PermissoesService {

    private final JdbcTemplate jdbc;
    private final DomainService domainService;

    private volatile String abasTable;

    private String abasTable() {
        if (abasTable != null) {
            return abasTable;
        }
        try {
            Boolean exists = jdbc.queryForObject(
                    "SELECT EXISTS (SELECT FROM information_schema.tables " +
                            "WHERE table_schema = 'public' AND table_name = 'plataforma_abas')",
                    Boolean.class);
            abasTable = Boolean.TRUE.equals(exists) ? "plataforma_abas" : "abas";
        } catch (Exception e) {
            abasTable = "abas";
        }
        return abasTable;
    }

    public List<Map<String, Object>> getAbas() {
        return jdbc.queryForList(
                "SELECT codigo, nome, descricao, icone, ordem, ativo FROM " + abasTable() +
                        " WHERE ativo = TRUE ORDER BY ordem");
    }

    public List<Map<String, Object>> getPermissoesUsuario(long usuarioId) {
        try {
            return jdbc.queryForList("SELECT * FROM obter_permissoes_usuario(?)", usuarioId);
        } catch (Exception e) {
            return jdbc.queryForList(
                    "SELECT a.codigo as aba_codigo, a.nome as aba_nome, a.icone as aba_icone, a.ordem as aba_ordem, " +
                            "COALESCE(pd.pode_acessar, false) as pode_acessar, " +
                            "COALESCE(pd.apenas_propria_diretoria, true) as apenas_propria_diretoria " +
                            "FROM " + abasTable() + " a LEFT JOIN permissoes_diretoria pd ON pd.aba_codigo = a.codigo " +
                            "AND pd.cadastros_areas_id = (SELECT cadastros_areas_id FROM users WHERE id = ?) " +
                            "WHERE a.ativo = TRUE ORDER BY a.ordem",
                    usuarioId);
        }
    }

    public Map<String, Object> verificarPermissao(long usuarioId, String abaCodigo) {
        List<Map<String, Object>> rows;
        try {
            rows = jdbc.queryForList("SELECT * FROM verificar_permissao(?, ?)", usuarioId, abaCodigo);
        } catch (Exception e) {
            rows = jdbc.queryForList(
                    "SELECT COALESCE(pd.pode_acessar, false) as pode_acessar, " +
                            "COALESCE(pd.apenas_propria_diretoria, true) as apenas_propria_diretoria, " +
                            "u.diretoria as diretoria_usuario FROM users u " +
                            "LEFT JOIN permissoes_diretoria pd ON pd.cadastros_areas_id = u.cadastros_areas_id AND pd.aba_codigo = ? " +
                            "WHERE u.id = ?",
                    abaCodigo, usuarioId);
        }
        if (rows.isEmpty()) {
            Map<String, Object> def = new LinkedHashMap<>();
            def.put("pode_acessar", false);
            def.put("apenas_propria_diretoria", true);
            def.put("diretoria_usuario", null);
            return def;
        }
        return rows.get(0);
    }

    public List<Map<String, Object>> getPermissoesDiretoria(String diretoria) {
        return jdbc.queryForList(
                "SELECT pd.diretoria, pd.aba_codigo, pd.pode_acessar, pd.apenas_propria_diretoria " +
                        "FROM permissoes_diretoria pd WHERE pd.cadastros_areas_id = (SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1) " +
                        "ORDER BY (SELECT ordem FROM " + abasTable() + " WHERE codigo = pd.aba_codigo)",
                diretoria);
    }

    public List<Map<String, Object>> getTodasPermissoes(String dominio) {
        String base = "SELECT pd.diretoria, pd.aba_codigo, pa.nome as aba_nome, pd.pode_acessar, " +
                "pd.apenas_propria_diretoria FROM permissoes_diretoria pd " +
                "JOIN " + abasTable() + " pa ON pa.codigo = pd.aba_codigo WHERE pa.ativo = TRUE";
        List<Map<String, Object>> rows;
        try {
            if (dominio != null) {
                rows = jdbc.queryForList(base + " AND pd.cadastros_areas_id IN (SELECT id FROM cadastros_areas " +
                        "WHERE dominio = ? AND COALESCE(ativo, TRUE) = TRUE) ORDER BY pd.diretoria, pa.ordem", dominio);
            } else {
                rows = jdbc.queryForList(base + " ORDER BY pd.diretoria, pa.ordem");
            }
        } catch (Exception e) {
            rows = jdbc.queryForList(base + " ORDER BY pd.diretoria, pa.ordem");
        }

        Map<String, List<Map<String, Object>>> agrupado = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String dir = String.valueOf(row.get("diretoria"));
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("aba_codigo", row.get("aba_codigo"));
            p.put("aba_nome", row.get("aba_nome"));
            p.put("pode_acessar", row.get("pode_acessar"));
            p.put("apenas_propria_diretoria", row.get("apenas_propria_diretoria"));
            agrupado.computeIfAbsent(dir, k -> new ArrayList<>()).add(p);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<String, List<Map<String, Object>>> e : agrupado.entrySet()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("diretoria", e.getKey());
            entry.put("permissoes", e.getValue());
            out.add(entry);
        }
        return out;
    }

    public String getDiretoriaUsuario(long usuarioId) {
        var rows = jdbc.queryForList(
                "SELECT diretoria FROM users WHERE id = ? AND is_deleted = FALSE", usuarioId);
        return rows.isEmpty() ? null : (String) rows.get(0).get("diretoria");
    }

    public boolean checkSuperAdmin(long userId) {
        var rows = jdbc.queryForList("SELECT is_superadmin FROM users WHERE id = ?", userId);
        return !rows.isEmpty() && Boolean.TRUE.equals(rows.get(0).get("is_superadmin"));
    }

    public boolean canManagePermissions(long userId) {
        if (checkSuperAdmin(userId)) {
            return true;
        }
        String diretoria = getDiretoriaUsuario(userId);
        if (diretoria == null) {
            return false;
        }
        return domainService.isDomainRoot(diretoria);
    }

    public Map<String, Object> atualizarPermissao(String diretoria, String abaCodigo, boolean podeAcessar,
                                                  boolean apenasPropriaDiretoria, long usuarioId) {
        var userCheck = jdbc.queryForList(
                "SELECT diretoria FROM users WHERE id = ? AND is_deleted = FALSE", usuarioId);
        if (userCheck.isEmpty()) {
            throw permissaoNegada();
        }
        String userDiretoria = (String) userCheck.get(0).get("diretoria");
        if (!domainService.isDomainRoot(userDiretoria)) {
            throw permissaoNegada();
        }
        if (!domainService.isSameDomain(userDiretoria, diretoria)) {
            throw permissaoNegada();
        }
        if (domainService.isDomainRoot(diretoria)) {
            throw naoPodeAlterarRaiz();
        }
        return jdbc.queryForMap(
                "INSERT INTO permissoes_diretoria (diretoria, aba_codigo, pode_acessar, apenas_propria_diretoria, updated_at, cadastros_areas_id) " +
                        "VALUES (?, ?, ?, ?, NOW(), (SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1)) ON CONFLICT (diretoria, aba_codigo) " +
                        "DO UPDATE SET pode_acessar = EXCLUDED.pode_acessar, " +
                        "apenas_propria_diretoria = EXCLUDED.apenas_propria_diretoria, updated_at = NOW() RETURNING *",
                diretoria, abaCodigo, podeAcessar, apenasPropriaDiretoria, diretoria);
    }

    public List<Map<String, Object>> atualizarPermissoesDiretoria(String diretoria,
                                                                  List<Map<String, Object>> permissoes, long usuarioId) {
        var userCheck = jdbc.queryForList(
                "SELECT diretoria, is_superadmin FROM users WHERE id = ? AND is_deleted = FALSE", usuarioId);
        if (userCheck.isEmpty()) {
            throw permissaoNegada();
        }
        String userDiretoria = (String) userCheck.get(0).get("diretoria");
        boolean isSuperAdmin = Boolean.TRUE.equals(userCheck.get(0).get("is_superadmin"));
        if (!domainService.isDomainRoot(userDiretoria) && !isSuperAdmin) {
            throw permissaoNegada();
        }
        if (!domainService.isSameDomain(userDiretoria, diretoria)) {
            throw permissaoNegada();
        }
        if (domainService.isDomainRoot(diretoria)) {
            throw naoPodeAlterarRaiz();
        }

        List<Map<String, Object>> resultados = new ArrayList<>();
        for (Map<String, Object> perm : permissoes) {
            try {
                Object aba = perm.get("aba_codigo");
                Object pode = perm.get("pode_acessar");
                Object apenas = perm.get("apenas_propria_diretoria");
                var updated = jdbc.queryForList(
                        "UPDATE permissoes_diretoria SET pode_acessar = ?, apenas_propria_diretoria = ?, updated_at = NOW() " +
                                "WHERE diretoria = ? AND aba_codigo = ? RETURNING *",
                        pode, apenas, diretoria, aba);
                if (!updated.isEmpty()) {
                    resultados.add(updated.get(0));
                } else {
                    resultados.add(jdbc.queryForMap(
                            "INSERT INTO permissoes_diretoria (diretoria, aba_codigo, pode_acessar, apenas_propria_diretoria, cadastros_areas_id) " +
                                    "VALUES (?, ?, ?, ?, (SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1)) RETURNING *",
                            diretoria, aba, pode, apenas, diretoria));
                }
            } catch (Exception ignored) {
                // continua com as outras
            }
        }
        if (resultados.isEmpty() && !permissoes.isEmpty()) {
            throw new ApiException(500, "Nenhuma permissão foi atualizada.");
        }
        return resultados;
    }

    private static final List<Map<String, String>> TODOS_MODULOS_SISTEMA = List.of(
            mod("dashboard", "Dashboard", "Painel inicial"),
            mod("gestao_okrs", "Monitoramento de OKRs", "Gestão Estratégica > Monitoramento de OKRs"),
            mod("gestao_execucao", "Controle de Execução", "Gestão Estratégica > Controle de Execução"),
            mod("gestao_sprint", "Sprint Atual", "Gestão Estratégica > Sprint Atual"),
            mod("contratacoes_novas", "Novas Contratações", "Contratações de TI > Novas Contratações"),
            mod("contratacoes_renovacoes", "Renovações", "Contratações de TI > Renovações"),
            mod("comites", "Comitês", "Gestão de comitês e reuniões"),
            mod("pessoas_painel", "Painel", "Pessoas > Painel de colaboradores"),
            mod("pessoas_competencias", "Gestão por Competências", "Pessoas > Gestão por Competências"),
            mod("pessoas_pac_ti", "PAC — Tecnologia da Informação",
                    "Pessoas > Plano Anual de Capacitação > Tecnologia da Informação"),
            mod("pessoas_pac_apoio", "PAC — Apoio Judiciário",
                    "Pessoas > Plano Anual de Capacitação > Apoio Judiciário"),
            mod("cadastros_projetos", "Projetos", "Cadastros > Gestão de projetos"),
            mod("cadastros_planos", "Planos/Programas", "Cadastros > Planos e programas"),
            mod("cadastros_areas", "Áreas", "Cadastros > Gestão de áreas"),
            mod("cadastros_pessoas", "Pessoas", "Cadastros > Cadastro de pessoas")
    );

    public List<Map<String, String>> getModulosNaoAdicionados() {
        List<String> existentes = jdbc.queryForList(
                "SELECT codigo FROM " + abasTable() + " WHERE ativo = TRUE", String.class);
        List<Map<String, String>> out = new ArrayList<>();
        for (Map<String, String> mod : TODOS_MODULOS_SISTEMA) {
            if (!existentes.contains(mod.get("codigo"))) {
                out.add(mod);
            }
        }
        return out;
    }

    public List<Map<String, Object>> adicionarModulosExistentes(List<String> codigos) {
        Map<String, Map<String, String>> modulosMap = new LinkedHashMap<>();
        for (Map<String, String> m : getModulosNaoAdicionados()) {
            modulosMap.put(m.get("codigo"), m);
        }
        List<Map<String, Object>> adicionados = new ArrayList<>();
        for (String codigo : codigos) {
            Map<String, String> modulo = modulosMap.get(codigo);
            if (modulo == null) {
                continue;
            }
            var inserted = jdbc.queryForList(
                    "INSERT INTO " + abasTable() + " (codigo, nome, descricao, icone, ordem, ativo) " +
                            "VALUES (?, ?, ?, ?, ?, true) ON CONFLICT (codigo) DO NOTHING " +
                            "RETURNING codigo, nome, descricao, icone, ordem, ativo",
                    codigo, modulo.get("nome"), modulo.get("descricao"), "LayoutDashboard", 999);
            if (!inserted.isEmpty()) {
                var allAreas = jdbc.queryForList(
                        "SELECT sigla, is_domain_root FROM cadastros_areas " +
                                "WHERE COALESCE(ativo, TRUE) = TRUE AND sigla IS NOT NULL");
                for (Map<String, Object> area : allAreas) {
                    boolean isRoot = Boolean.TRUE.equals(area.get("is_domain_root"));
                    jdbc.update(
                            "INSERT INTO permissoes_diretoria (diretoria, aba_codigo, pode_acessar, apenas_propria_diretoria, cadastros_areas_id) " +
                                    "VALUES (?, ?, ?, ?, (SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1)) ON CONFLICT (diretoria, aba_codigo) DO NOTHING",
                            area.get("sigla"), codigo, isRoot, !isRoot, area.get("sigla"));
                }
                adicionados.add(inserted.get(0));
            }
        }
        return adicionados;
    }

    private static Map<String, String> mod(String codigo, String nome, String descricao) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("codigo", codigo);
        m.put("nome", nome);
        m.put("descricao", descricao);
        return m;
    }

    private static ApiException permissaoNegada() {
        return new ApiException(403, "Apenas administradores de domínio podem alterar permissões");
    }

    private static ApiException naoPodeAlterarRaiz() {
        return new ApiException(400, "Não é permitido alterar permissões da diretoria raiz");
    }
}
