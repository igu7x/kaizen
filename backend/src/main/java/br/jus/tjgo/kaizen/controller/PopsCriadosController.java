package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.AuthenticatedUser;
import br.jus.tjgo.kaizen.service.PopsCriadosService;
import br.jus.tjgo.kaizen.service.ProcessosNegocioService;
import br.jus.tjgo.kaizen.util.Validadores;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * POPs (Procedimento Operacional Padrão) criados no Kaizen — Escritório de Processos.
 *
 * Fluxo de validação em 3 etapas (o POP não passa por Compliance), todas ancoradas no PROCESSO:
 *   - Propor   (1ª) = quem preencheu — o editor atribuído ou o próprio Responsável do processo;
 *   - Analisar (2ª) = Responsável do processo;
 *   - Aprovar  (3ª) = diretor da macroárea a que o processo pertence.
 *
 * POP sem `processo_id` (criado antes da migration 260) cai na regra ANTERIOR — analisar pelo
 * gestor/sub-diretor e aprovar pelo diretor, ambos pela sigla gravada no próprio POP. Sem esse
 * fallback, todo POP antigo ficaria impossível de validar.
 */
@RestController
@RequestMapping("/api/pops-criados")
@RequiredArgsConstructor
public class PopsCriadosController {

    private final PopsCriadosService service;
    private final ProcessosNegocioService processosService;

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
        ResponseEntity<?> negado = validarAlcance(body);
        if (negado != null) {
            return negado;
        }
        long uid = opt.map(AuthenticatedUser::id).orElse(0L);
        String nome = opt.map(AuthenticatedUser::name).orElse(null);
        return ResponseEntity.status(201)
                .body(service.create(uid, nome, body, ocupaCamada1(body, opt.orElse(null))));
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(@PathVariable long id, @RequestBody Map<String, Object> body) {
        if (service.getById(id) == null) {
            return ResponseEntity.status(404).body(Map.of("error", "POP não encontrado"));
        }
        ResponseEntity<?> negado = validarAlcance(body);
        if (negado != null) {
            return negado;
        }
        return ResponseEntity.ok(service.update(id, body));
    }

    /**
     * O POP só pode apontar para processo dentro do alcance de quem preenche: Editor atribuído,
     * Responsável, Revisor (gestor da diretoria), Gestor do Escritório (superadmin) ou Compliance
     * Officer. Devolve o 403 pronto quando barra, ou {@code null} quando pode seguir.
     *
     * Duas passagens livres, ambas de propósito:
     *   - payload SEM processo_id: POP legado (a coluna só existe a partir da migration 260) e
     *     edição que não mexe no vínculo;
     *   - usuário sem papel NENHUM: mesma rede de segurança do seletor — o POP nunca teve controle
     *     de acesso, e bloquear aqui tiraria de quem cria POP hoje sem papel formal.
     */
    private ResponseEntity<?> validarAlcance(Map<String, Object> body) {
        Object bruto = body == null ? null : body.get("processo_id");
        if (bruto == null || String.valueOf(bruto).isBlank()) {
            return null;
        }
        long processoId;
        try {
            processoId = Long.parseLong(String.valueOf(bruto).trim());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "processo_id inválido"));
        }
        var opt = AuthContext.getCurrentUser();
        if (opt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Autenticação necessária"));
        }
        AuthenticatedUser u = opt.get();
        if (u.isSuperadmin() || Validadores.isFinal(u.email())) {
            return null;
        }
        if (processosService.idsComPapel(u.id()).isEmpty()) {
            return null;
        }
        if (processosService.temPapelNoProcesso(u.id(), processoId)) {
            return null;
        }
        return ResponseEntity.status(403).body(Map.of(
                "error", "Você não é editor, responsável nem revisor deste processo."));
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
        if (!podeAnalisar(pop, u)) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Apenas o responsável do processo pode analisar este POP."));
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
        if (!podeAprovar(pop, u)) {
            return ResponseEntity.status(403).body(Map.of(
                    "error", "Apenas o diretor da macroárea do processo pode aprovar este POP."));
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
        // Recusar cabe a QUALQUER uma das duas camadas de revisão: o Responsável (2ª) e o diretor
        // da macroárea (3ª). Antes bastava podeAnalisar porque o diretor estava dentro daquele
        // conjunto; agora que a 2ª camada é só o Responsável, o diretor precisa ser somado de
        // volta, senão ele perderia a recusa que já tinha.
        if (!podeAnalisar(pop, u) && !podeAprovar(pop, u)) {
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
    /** 2ª camada: Responsável do processo. POP legado (sem vínculo) mantém a regra antiga. */
    private boolean podeAnalisar(Map<String, Object> pop, AuthenticatedUser u) {
        if (u.isSuperadmin() || "ADMIN".equalsIgnoreCase(u.role())) {
            return true;
        }
        Long processoId = processoIdDo(pop);
        if (processoId != null) {
            return processosService.isResponsavelDoProcesso(u.id(), processoId);
        }
        Map<String, Object> g = service.gestoresDaArea(str(pop.get("area")));
        if (g == null) {
            return false;
        }
        return eqId(g.get("gestor_user_id"), u.id()) || eqId(g.get("subdiretor_user_id"), u.id());
    }

    /**
     * Quem preencheu ocupa a 1ª camada ("Proposto por")?
     *
     * Sim, EXCETO quando é um superadmin preenchendo POP de processo do qual ele não é o
     * Responsável: aí ele apenas salva, a camada 1 fica vaga, e o Responsável assume as duas ao
     * validar. Superadmin que É o Responsável segue o fluxo normal, ocupando a 1ª.
     *
     * POP sem vínculo com processo (legado) mantém o comportamento antigo: não há como saber quem
     * é o Responsável, então quem cria ocupa a camada.
     */
    private boolean ocupaCamada1(Map<String, Object> body, AuthenticatedUser u) {
        if (u == null || !u.isSuperadmin()) {
            return true;
        }
        Long processoId = processoIdDo(body);
        if (processoId == null) {
            return true;
        }
        return processosService.isResponsavelDoProcesso(u.id(), processoId);
    }

    /** Id do processo vinculado ao POP, ou null quando é POP legado. */
    private Long processoIdDo(Map<String, Object> pop) {
        Object v = pop == null ? null : pop.get("processo_id");
        if (v == null) {
            return null;
        }
        try {
            return Long.parseLong(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 3ª camada: diretor (gestor_user_id) da macroárea a que o PROCESSO pertence.
     *
     * A sigla vem do processo, e não do campo `area` do POP: são o mesmo valor no caminho feliz,
     * mas o do POP é texto editável e pode ter sido alterado depois. POP legado cai no campo.
     */
    private boolean podeAprovar(Map<String, Object> pop, AuthenticatedUser u) {
        if (u.isSuperadmin() || "ADMIN".equalsIgnoreCase(u.role())) {
            return true;
        }
        Long processoId = processoIdDo(pop);
        String area = processoId != null ? processosService.diretoriaDoProcesso(processoId) : null;
        if (area == null || area.isBlank()) {
            area = str(pop.get("area"));
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
