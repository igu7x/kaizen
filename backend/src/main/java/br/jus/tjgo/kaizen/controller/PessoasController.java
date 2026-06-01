package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.DomainService;
import br.jus.tjgo.kaizen.service.PessoasService;
import br.jus.tjgo.kaizen.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Porte fiel de routes/pessoas.ts. NÃO retorna 401 (getCurrentUserId = principal ou null).
 */
@RestController
@RequestMapping("/api/pessoas")
@RequiredArgsConstructor
public class PessoasController {

    private final PessoasService service;
    private final UserService userService;
    private final DomainService domainService;

    private Long getCurrentUserId() {
        return AuthContext.getCurrentUser().map(u -> u.id()).orElse(null);
    }

    /** Endpoint temporário do Node que roda DDL. No-op aqui (schema já existe; não alteramos o banco). */
    @GetMapping("/run-migration")
    public Map<String, Object> runMigration() {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Tabela cadastros_pessoas criada/atualizada com sucesso!");
        return body;
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(value = "dominio", required = false) String dominioParam) {
        String dominio = (dominioParam != null && !dominioParam.isBlank()) ? dominioParam : null;
        if (dominio == null) {
            Long userId = getCurrentUserId();
            if (userId != null) {
                Map<String, Object> user = userService.findUserById(userId);
                if (user != null && !Boolean.TRUE.equals(user.get("is_superadmin")) && user.get("diretoria") != null) {
                    dominio = domainService.getDomainForDiretoria(String.valueOf(user.get("diretoria"))).dominio();
                }
            }
        }
        return service.getAll(dominio);
    }

    @GetMapping("/area/{areaId:\\d+}")
    public List<Map<String, Object>> byArea(@PathVariable long areaId) {
        return service.getByAreaId(areaId);
    }

    @GetMapping("/unidade/{unidadeId:\\d+}")
    public List<Map<String, Object>> byUnidade(@PathVariable long unidadeId) {
        return service.getByUnidadeId(unidadeId);
    }

    @GetMapping("/{id:\\d+}/perfil-completo")
    public ResponseEntity<?> perfilCompleto(@PathVariable long id) {
        Map<String, Object> p = service.getPerfilCompleto(id);
        if (p == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Pessoa não encontrada"));
        }
        return ResponseEntity.ok(p);
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getById(@PathVariable long id) {
        Map<String, Object> p = service.getById(id);
        if (p == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Pessoa não encontrada"));
        }
        return ResponseEntity.ok(p);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        Long userId = getCurrentUserId();
        if (body.get("area_id") == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Área é obrigatória"));
        }
        Object nomeObj = body.get("nome");
        String nome = nomeObj == null ? null : String.valueOf(nomeObj).trim();
        if (nome == null || nome.length() < 2) {
            return ResponseEntity.status(400).body(Map.of("error", "Nome é obrigatório e deve ter pelo menos 2 caracteres"));
        }

        body.put("nome", nome);
        Map<String, Object> pessoa = service.create(body, userId);

        Object emailObj = body.get("email");
        if (emailObj != null && !String.valueOf(emailObj).trim().isEmpty()) {
            service.syncCreateUser(String.valueOf(emailObj), nome, body.get("area_id"),
                    ((Number) pessoa.get("id")).longValue());
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(pessoa);
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Long userId = getCurrentUserId();

        Object subId = body.get("subordinacao_id");
        if (subId != null && ((Number) subId).longValue() == id) {
            return ResponseEntity.status(400).body(Map.of("error", "Uma pessoa não pode ser subordinada de si mesma"));
        }
        if (body.containsKey("subordinacao_id") && subId != null) {
            Map<String, Object> pessoaAtual = service.getById(id);
            Map<String, Object> pessoaSuperior = service.getById(((Number) subId).longValue());
            if (pessoaSuperior == null) {
                return ResponseEntity.status(400).body(Map.of("error", "Pessoa superior não encontrada"));
            }
            if (pessoaAtual != null && !String.valueOf(pessoaAtual.get("area_id")).equals(String.valueOf(pessoaSuperior.get("area_id")))) {
                return ResponseEntity.status(400).body(Map.of("error", "A subordinação deve ser entre pessoas da mesma área"));
            }
        }

        Map<String, Object> pessoa = service.update(id, body, userId);
        if (pessoa == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Pessoa não encontrada"));
        }
        Object email = pessoa.get("email");
        if (email != null && !String.valueOf(email).isBlank()) {
            service.resyncUserId(String.valueOf(email), ((Number) pessoa.get("id")).longValue());
        }
        return ResponseEntity.ok(pessoa);
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(@PathVariable long id) {
        Long userId = getCurrentUserId();
        boolean deleted = service.delete(id, userId);
        if (!deleted) {
            return ResponseEntity.status(404).body(Map.of("error", "Pessoa não encontrada"));
        }
        return ResponseEntity.ok(Map.of("message", "Pessoa excluída com sucesso"));
    }
}
