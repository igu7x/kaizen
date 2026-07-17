package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.DomainService;
import br.jus.tjgo.kaizen.service.PermissoesService;
import br.jus.tjgo.kaizen.util.Flash;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Porte fiel de routes/permissoes.ts. Tem checks 401/403/400 reais. */
@RestController
@RequestMapping("/api/permissoes")
@RequiredArgsConstructor
public class PermissoesController {

    private final PermissoesService service;
    private final DomainService domainService;
    private final JdbcTemplate jdbc;

    /** principal -> body.userId -> header x-user-id -> null. */
    private Long getCurrentUserId(HttpServletRequest req, Map<String, Object> body) {
        Long principal = AuthContext.getCurrentUser().map(u -> u.id()).orElse(null);
        if (principal != null) {
            return principal;
        }
        if (body != null && body.get("userId") != null) {
            try {
                return Long.parseLong(String.valueOf(body.get("userId")));
            } catch (NumberFormatException ignored) {
                // segue
            }
        }
        String header = req.getHeader("x-user-id");
        if (header != null && !header.isBlank()) {
            try {
                return Long.parseLong(header.trim());
            } catch (NumberFormatException ignored) {
                // segue
            }
        }
        return null;
    }

    @GetMapping("/abas")
    public List<Map<String, Object>> abas() {
        return service.getAbas();
    }

    @GetMapping("/usuario/{id}")
    public ResponseEntity<?> permissoesUsuario(@PathVariable String id) {
        long usuarioId;
        try {
            usuarioId = Long.parseLong(id);
        } catch (NumberFormatException e) {
            return ResponseEntity.status(400).body(Map.of("error", "ID inválido"));
        }
        return ResponseEntity.ok(service.getPermissoesUsuario(usuarioId));
    }

    @GetMapping("/minha")
    public ResponseEntity<?> minha(HttpServletRequest req) {
        Long userId = getCurrentUserId(req, null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não autenticado"));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("diretoria", service.getDiretoriaUsuario(userId));
        body.put("permissoes", service.getPermissoesUsuario(userId));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/menu/{diretoria}")
    public ResponseEntity<?> menu(@PathVariable String diretoria) {
        if (!domainService.isValidDiretoria(diretoria)) {
            return ResponseEntity.status(400).body(Map.of("error", "Diretoria inválida"));
        }
        List<Map<String, Object>> permissoes = service.getPermissoesDiretoria(diretoria);
        List<Map<String, Object>> abas = service.getAbas();
        Map<String, Map<String, Object>> abasMap = new LinkedHashMap<>();
        for (Map<String, Object> a : abas) {
            abasMap.put(String.valueOf(a.get("codigo")), a);
        }
        List<Map<String, Object>> modulos = new ArrayList<>();
        for (Map<String, Object> p : permissoes) {
            if (!Boolean.TRUE.equals(p.get("pode_acessar"))) {
                continue;
            }
            Map<String, Object> aba = abasMap.get(String.valueOf(p.get("aba_codigo")));
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("codigo", p.get("aba_codigo"));
            m.put("nome", aba != null && aba.get("nome") != null ? aba.get("nome") : p.get("aba_codigo"));
            m.put("descricao", aba != null ? aba.get("descricao") : null);
            m.put("apenas_propria_diretoria", p.get("apenas_propria_diretoria"));
            modulos.add(m);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("diretoria", diretoria);
        body.put("modulos_permitidos", modulos);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/verificar/{aba}")
    public ResponseEntity<?> verificar(HttpServletRequest req, @PathVariable String aba) {
        Long userId = getCurrentUserId(req, null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não autenticado"));
        }
        return ResponseEntity.ok(service.verificarPermissao(userId, aba));
    }

    @GetMapping("/diretoria/{diretoria}")
    public ResponseEntity<?> permissoesDiretoria(@PathVariable String diretoria) {
        if (!domainService.isValidDiretoria(diretoria)) {
            return ResponseEntity.status(400).body(Map.of("error", "Diretoria inválida"));
        }
        return ResponseEntity.ok(service.getPermissoesDiretoria(diretoria));
    }

    @GetMapping("/todas")
    public ResponseEntity<?> todas(HttpServletRequest req) {
        Long userId = getCurrentUserId(req, null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não autenticado"));
        }
        String diretoria = service.getDiretoriaUsuario(userId);
        if (diretoria == null || !service.canManagePermissions(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas administradores de domínio podem ver todas as permissões"));
        }
        String dominio = domainService.getDomainForDiretoria(diretoria).dominio();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("abas", service.getAbas());
        body.put("permissoes_por_diretoria", service.getTodasPermissoes(dominio));
        return ResponseEntity.ok(body);
    }

    @PutMapping("/diretoria/{diretoria}")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> atualizarDiretoria(HttpServletRequest req, @PathVariable String diretoria,
                                                @RequestBody Map<String, Object> requestBody) {
        Long userId = getCurrentUserId(req, requestBody);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não autenticado"));
        }
        if (!domainService.isValidDiretoria(diretoria)) {
            return ResponseEntity.status(400).body(Map.of("error", "Diretoria inválida"));
        }
        Object permObj = requestBody.get("permissoes");
        if (!(permObj instanceof List)) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("error", "Permissões devem ser um array");
            err.put("exemplo", List.of(Map.of("aba_codigo", "gestao_estrategica",
                    "pode_acessar", true, "apenas_propria_diretoria", true)));
            return ResponseEntity.status(400).body(err);
        }
        List<Map<String, Object>> permissoes = (List<Map<String, Object>>) permObj;
        List<Map<String, Object>> resultado = service.atualizarPermissoesDiretoria(diretoria, permissoes, userId);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Permissões de " + diretoria + " atualizadas");
        body.put("permissoes", resultado);
        return Flash.success(body, "Permissões de " + diretoria + " atualizadas com sucesso!");
    }

    @PutMapping("/diretoria/{diretoria}/aba/{aba}")
    public ResponseEntity<?> atualizarPermissaoAba(HttpServletRequest req, @PathVariable String diretoria,
                                                   @PathVariable String aba, @RequestBody Map<String, Object> requestBody) {
        Long userId = getCurrentUserId(req, requestBody);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não autenticado"));
        }
        if (!domainService.isValidDiretoria(diretoria)) {
            return ResponseEntity.status(400).body(Map.of("error", "Diretoria inválida"));
        }
        Object podeAcessar = requestBody.get("pode_acessar");
        if (!(podeAcessar instanceof Boolean)) {
            return ResponseEntity.status(400).body(Map.of("error", "pode_acessar deve ser boolean"));
        }
        Object apenasProp = requestBody.get("apenas_propria_diretoria");
        boolean apenas = apenasProp instanceof Boolean b && b;
        Map<String, Object> resultado = service.atualizarPermissao(diretoria, aba, (Boolean) podeAcessar, apenas, userId);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("permissao", resultado);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/modulos-nao-adicionados")
    public ResponseEntity<?> modulosNaoAdicionados(HttpServletRequest req) {
        Long userId = getCurrentUserId(req, null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não autenticado"));
        }
        if (!service.canManagePermissions(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas administradores de domínio podem acessar esta funcionalidade"));
        }
        return ResponseEntity.ok(service.getModulosNaoAdicionados());
    }

    @PostMapping("/adicionar-modulos")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> adicionarModulos(HttpServletRequest req, @RequestBody Map<String, Object> requestBody) {
        Long userId = getCurrentUserId(req, requestBody);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não autenticado"));
        }
        if (!service.canManagePermissions(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Apenas administradores de domínio podem adicionar módulos"));
        }
        Object codigosObj = requestBody.get("codigos");
        if (!(codigosObj instanceof List) || ((List<?>) codigosObj).isEmpty()) {
            return ResponseEntity.status(400).body(Map.of("error", "Códigos devem ser um array não vazio"));
        }
        List<String> codigos = new ArrayList<>();
        for (Object o : (List<Object>) codigosObj) {
            codigos.add(String.valueOf(o));
        }
        List<Map<String, Object>> resultado = service.adicionarModulosExistentes(codigos);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", resultado.size() + " módulo(s) adicionado(s) com sucesso");
        body.put("modulos", resultado);
        return Flash.success(body, resultado.size() + " módulo(s) adicionado(s) com sucesso!");
    }

    @GetMapping("/debug")
    public ResponseEntity<?> debug() {
        Boolean hasPlataforma = jdbc.queryForObject(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' " +
                        "AND table_name='plataforma_abas')", Boolean.class);
        String tableName = Boolean.TRUE.equals(hasPlataforma) ? "plataforma_abas" : "abas";
        Object abasCount = jdbc.queryForList("SELECT COUNT(*) as total FROM " + tableName).get(0).get("total");
        Object permCount = jdbc.queryForList("SELECT COUNT(*) as total FROM permissoes_diretoria").get(0).get("total");
        List<String> diretorias = jdbc.queryForList(
                "SELECT DISTINCT a.sigla FROM permissoes_diretoria pd JOIN cadastros_areas a ON pd.cadastros_areas_id = a.id ORDER BY a.sigla", String.class);
        var amostra = jdbc.queryForList(
                "SELECT a.sigla as diretoria, pd.aba_codigo, pd.pode_acessar FROM permissoes_diretoria pd JOIN cadastros_areas a ON pd.cadastros_areas_id = a.id ORDER BY a.sigla, pd.aba_codigo LIMIT 50");
        var sgjUsers = jdbc.queryForList(
                "SELECT id, name, email, diretoria FROM users WHERE diretoria = 'SGJT' LIMIT 5");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("tabela_abas", tableName);
        body.put("total_abas", abasCount);
        body.put("total_permissoes", permCount);
        body.put("diretorias_distintas", diretorias);
        body.put("usuarios_sgjt", sgjUsers);
        body.put("amostra_permissoes", amostra);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/debug/usuario/{id}")
    public ResponseEntity<?> debugUsuario(@PathVariable String id) {
        long userId;
        try {
            userId = Long.parseLong(id);
        } catch (NumberFormatException e) {
            return ResponseEntity.status(400).body(Map.of("error", "ID inválido"));
        }
        var userData = jdbc.queryForList(
                "SELECT id, name, email, role, diretoria, directorate_code, is_deleted, created_at FROM users WHERE id = ?",
                userId);
        if (userData.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Usuário não encontrado"));
        }
        Map<String, Object> user = userData.get(0);
        List<Map<String, Object>> permissoes = service.getPermissoesUsuario(userId);
        String diretoriaUsuario = service.getDiretoriaUsuario(userId);
        long acessiveis = permissoes.stream().filter(p -> Boolean.TRUE.equals(p.get("pode_acessar"))).count();

        Map<String, Object> diagnostico = new LinkedHashMap<>();
        diagnostico.put("tem_coluna_diretoria", true);
        diagnostico.put("tem_coluna_directorate_code", true);
        diagnostico.put("diretoria_preenchida", user.get("diretoria") != null);
        diagnostico.put("e_domain_root", diretoriaUsuario != null && domainService.isDomainRoot(diretoriaUsuario));
        diagnostico.put("is_superadmin", service.checkSuperAdmin(userId));
        diagnostico.put("pode_alterar_permissoes", service.canManagePermissions(userId));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("usuario", user);
        body.put("colunas_disponiveis", List.of("diretoria", "directorate_code"));
        body.put("diretoria_detectada", diretoriaUsuario);
        body.put("total_permissoes", permissoes.size());
        body.put("permissoes_acessiveis", acessiveis);
        body.put("diagnostico", diagnostico);
        return ResponseEntity.ok(body);
    }
}
