package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.AuthenticatedUser;
import br.jus.tjgo.kaizen.service.PopsCriadosService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * POPs (Procedimento Operacional Padrão) criados no Kaizen — Escritório de Processos.
 *
 * Fluxo de validação em 3 etapas (o POP não passa por Compliance):
 *   - Propor   = criar o POP (qualquer usuário que possa criar);
 *   - Analisar = gestor/sub-diretor da área;
 *   - Aprovar  = diretor da área (cadastros_areas.gestor_user_id).
 */
@RestController
@RequestMapping("/api/pops-criados")
@RequiredArgsConstructor
public class PopsCriadosController {

    private final PopsCriadosService service;

    @GetMapping
    public List<Map<String, Object>> list() {
        return service.list();
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getById(@PathVariable long id) {
        Map<String, Object> pop = service.getById(id);
        if (pop == null) {
            return ResponseEntity.status(404).body(Map.of("error", "POP não encontrado"));
        }
        return ResponseEntity.ok(pop);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        var opt = AuthContext.getCurrentUser();
        long uid = opt.map(AuthenticatedUser::id).orElse(0L);
        String nome = opt.map(AuthenticatedUser::name).orElse(null);
        return ResponseEntity.status(201).body(service.create(uid, nome, body));
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody Map<String, Object> body) {
        if (service.getById(id) == null) {
            return ResponseEntity.status(404).body(Map.of("error", "POP não encontrado"));
        }
        return ResponseEntity.ok(service.update(id, body));
    }

    @PostMapping("/{id:\\d+}/analisar")
    public ResponseEntity<?> analisar(@PathVariable long id) {
        Map<String, Object> pop = service.getById(id);
        if (pop == null) {
            return ResponseEntity.status(404).body(Map.of("error", "POP não encontrado"));
        }
        AuthenticatedUser u = AuthContext.getCurrentUser().orElse(null);
        if (u == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!podeAnalisar(str(pop.get("area")), u)) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Apenas o gestor ou sub-diretor da área pode analisar este POP."));
        }
        Map<String, Object> upd = service.analisar(id, u.id(), u.name());
        if (upd == null) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "O POP não está aguardando análise."));
        }
        return ResponseEntity.ok(upd);
    }

    @PostMapping("/{id:\\d+}/aprovar")
    public ResponseEntity<?> aprovar(@PathVariable long id) {
        Map<String, Object> pop = service.getById(id);
        if (pop == null) {
            return ResponseEntity.status(404).body(Map.of("error", "POP não encontrado"));
        }
        AuthenticatedUser u = AuthContext.getCurrentUser().orElse(null);
        if (u == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!podeAprovar(str(pop.get("area")), u)) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Apenas o diretor da área pode aprovar este POP."));
        }
        Map<String, Object> upd = service.aprovar(id, u.id(), u.name());
        if (upd == null) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "O POP precisa estar analisado para ser aprovado."));
        }
        return ResponseEntity.ok(upd);
    }

    @PostMapping("/{id:\\d+}/recusar")
    public ResponseEntity<?> recusar(@PathVariable long id) {
        Map<String, Object> pop = service.getById(id);
        if (pop == null) {
            return ResponseEntity.status(404).body(Map.of("error", "POP não encontrado"));
        }
        AuthenticatedUser u = AuthContext.getCurrentUser().orElse(null);
        if (u == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!podeAnalisar(str(pop.get("area")), u)) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Sem permissão para recusar este POP."));
        }
        Map<String, Object> upd = service.recusar(id);
        if (upd == null) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "Só é possível recusar um POP já analisado ou aprovado."));
        }
        return ResponseEntity.ok(upd);
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(@PathVariable long id) {
        if (!service.delete(id)) {
            return ResponseEntity.status(404).body(Map.of("error", "POP não encontrado"));
        }
        return ResponseEntity.ok(Map.of("message", "POP excluído com sucesso"));
    }

    // Analisar: gestor (diretor) OU sub-diretor da área, ou ADMIN/superadmin.
    private boolean podeAnalisar(String area, AuthenticatedUser u) {
        if (u.isSuperadmin() || "ADMIN".equalsIgnoreCase(u.role())) {
            return true;
        }
        Map<String, Object> g = service.gestoresDaArea(area);
        if (g == null) {
            return false;
        }
        return eqId(g.get("gestor_user_id"), u.id()) || eqId(g.get("subdiretor_user_id"), u.id());
    }

    // Aprovar: apenas o diretor da área (gestor_user_id), ou ADMIN/superadmin.
    private boolean podeAprovar(String area, AuthenticatedUser u) {
        if (u.isSuperadmin() || "ADMIN".equalsIgnoreCase(u.role())) {
            return true;
        }
        Map<String, Object> g = service.gestoresDaArea(area);
        if (g == null) {
            return false;
        }
        return eqId(g.get("gestor_user_id"), u.id());
    }

    private boolean eqId(Object a, Long b) {
        if (a == null || b == null) {
            return false;
        }
        return ((Number) a).longValue() == b.longValue();
    }

    private String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
