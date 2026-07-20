package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.service.PcaDetailsService;
import br.jus.tjgo.kaizen.service.PcaService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de pca.ts + pca-details.ts (mesmo prefixo /api/pca-items).
 * Auth header-based: X-User-Role (ou body.userRole) deve ser MANAGER/ADMIN;
 * X-User-Id (ou
 * body.userId) com default 1. validatePcaItem (404) roda ANTES do
 * isGestorOrAdmin nos sub-recursos.
 */
@RestController
@RequestMapping("/api/pca-items")
@RequiredArgsConstructor
public class PcaItemsController {

    private final PcaService pcaService;
    private final PcaDetailsService detailsService;

    private static final List<String> STATUS_ITEM = List.of("Concluída", "Em andamento", "Não Iniciada");
    private static final List<String> STATUS_TAREFA = List.of("Não iniciada", "Em andamento", "Concluída");

    // ---------- auth helpers (paridade pca.ts) ----------

    private void requireGestorOrAdmin(HttpServletRequest req, Map<String, Object> body) {
        String role = headerOrBody(req, body, "x-user-role", "userRole");
        if (role == null || role.isEmpty()) {
            throw new ApiException(401, "Não autenticado");
        }
        String up = role.toUpperCase();
        if (!up.equals("MANAGER") && !up.equals("ADMIN")) {
            throw new ApiException(403, "Acesso negado. Apenas gestores e administradores podem realizar esta ação.");
        }
    }

    private long userId(HttpServletRequest req, Map<String, Object> body) {
        String v = headerOrBody(req, body, "x-user-id", "userId");
        if (v == null) {
            return 1;
        }
        try {
            return Long.parseLong(v.trim());
        } catch (NumberFormatException e) {
            return 1;
        }
    }

    private static String headerOrBody(HttpServletRequest req, Map<String, Object> body, String header,
            String bodyKey) {
        String h = req.getHeader(header);
        if (h != null && !h.isEmpty()) {
            return h;
        }
        if (body != null && body.get(bodyKey) != null) {
            return String.valueOf(body.get(bodyKey));
        }
        return null;
    }

    private Map<String, Object> requireItem(long id) {
        Map<String, Object> item = pcaService.findById(id);
        if (item == null) {
            throw new ApiException(404, "Item PCA não encontrado");
        }
        return item;
    }

    // ============================================================
    // PCA ITEMS (pca.ts)
    // ============================================================

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(value = "ano", required = false) Integer ano,
            @RequestParam(value = "diretoriaId", required = false) Long diretoriaId,
            @RequestParam(value = "versionNumber", required = false) Integer versionNumber) {
        return pcaService.findAll(ano, diretoriaId, versionNumber);
    }

    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestParam(value = "ano", required = false) Integer ano,
            @RequestParam(value = "diretoriaId", required = false) Long diretoriaId,
            @RequestParam(value = "versionNumber", required = false) Integer versionNumber) {
        return pcaService.getStats(ano, diretoriaId, versionNumber);
    }

    @GetMapping("/versions")
    public List<Integer> versions(@RequestParam(value = "ano", required = true) Integer ano) {
        return pcaService.getAvailableVersions(ano);
    }

    // RF-46/57 — proveniência das versões publicadas (versão → finalidade/ciclo/data)
    @GetMapping("/versoes-info")
    public List<Map<String, Object>> versoesInfo(@RequestParam(value = "ano", required = true) Integer ano) {
        return pcaService.getVersoesInfo(ano);
    }

    // RF-54 — comparação entre duas versões do PCA-TIC. versaoNova/versaoAntiga nulos = versão viva (atual).
    @GetMapping("/compare")
    public Map<String, Object> compare(@RequestParam(value = "ano", required = true) Integer ano,
            @RequestParam(value = "versaoNova", required = false) Integer versaoNova,
            @RequestParam(value = "versaoAntiga", required = false) Integer versaoAntiga) {
        return pcaService.compareVersions(ano, versaoNova, versaoAntiga);
    }

    @PostMapping("/snapshots")
    public ResponseEntity<?> createSnapshot(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req, body);
        Integer ano = parseIntJs(body.get("ano"));
        if (ano == null) {
            return ResponseEntity.status(400).body(err("Ano é obrigatório para gerar snapshot"));
        }
        pcaService.createSnapshot(ano, userId(req, body));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "Snapshot criado com sucesso"));
    }

    @GetMapping("/filters")
    public Map<String, Object> filters() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("areasDemandantes", pcaService.getAreasDemandantes());
        out.put("responsaveis", pcaService.getResponsaveis());
        out.put("meses", pcaService.getMeses());
        out.put("statusOptions", List.of("Concluída", "Em andamento", "Não Iniciada"));
        return out;
    }

    @GetMapping("/debug/{id}")
    public ResponseEntity<?> debug(@PathVariable String id) {
        Map<String, Object> byId = null;
        try {
            byId = pcaService.findById(Long.parseLong(id));
        } catch (NumberFormatException ignored) {
            // segue
        }
        Map<String, Object> byItemPca = pcaService.findByItemPca(id);
        Map<String, Object> stats = pcaService.getStats(null, null, null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("debug", true);
        out.put("id_buscado", id);
        out.put("tipo_id", "string");
        out.put("resultado_por_id_numerico", byId);
        out.put("resultado_por_item_pca", byItemPca);
        Map<String, Object> est = new LinkedHashMap<>();
        est.put("total_registros", stats.get("total"));
        est.put("mensagem", "Verifique se os registros existem e não estão deletados");
        out.put("estatisticas", est);
        out.put("proximos_passos", List.of(
                "Se resultado_por_id_numerico está null, o registro não existe ou está deletado",
                "Execute no terminal: node scripts/diagnose-pca-items.js",
                "Se necessário, restaure os registros: node scripts/fix-pca-deleted.js"));
        return ResponseEntity.ok(out);
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<?> getById(@PathVariable long id) {
        Map<String, Object> item = pcaService.findById(id);
        if (item == null) {
            return ResponseEntity.status(404).body(err("Item PCA não encontrado"));
        }
        return ResponseEntity.ok(item);
    }

    @PostMapping
    public ResponseEntity<?> create(HttpServletRequest req, @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req, body);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("item_pca", body.get("item_pca"));
        data.put("tipo", body.get("tipo") != null ? body.get("tipo") : "Contratação");
        data.put("area_demandante", body.get("area_demandante"));
        data.put("objeto", body.get("objeto"));
        Double valorEstimado = parseFloatJs(body.get("valor_estimado"));
        data.put("valor_estimado", valorEstimado);
        if (body.containsKey("valor_formalizado")) {
            data.put("valor_formalizado", parseFloatJs(body.get("valor_formalizado")));
        }
        data.put("data_estimada_contratacao", body.get("data_estimada_contratacao"));
        data.put("status", body.get("status") != null ? body.get("status") : "Não Iniciada");
        if (body.get("ano") != null) {
            data.put("ano", parseIntJs(body.get("ano")));
        }
        // Novos campos FK para diretoria/área
        if (body.containsKey("id_diretoria")) {
            data.put("id_diretoria", body.get("id_diretoria"));
        }
        if (body.containsKey("id_area_demandante")) {
            data.put("id_area_demandante", body.get("id_area_demandante"));
        }
        if (body.containsKey("process"))
            data.put("process", body.get("process"));
        if (body.containsKey("description"))
            data.put("description", body.get("description"));
        if (body.containsKey("justification"))
            data.put("justification", body.get("justification"));
        if (body.containsKey("financial_resource_type"))
            data.put("financial_resource_type", body.get("financial_resource_type"));
        if (body.containsKey("priority"))
            data.put("priority", body.get("priority"));
        if (body.containsKey("step"))
            data.put("step", body.get("step"));

        List<String> errors = new ArrayList<>();
        String itemPca = str(data.get("item_pca"));
        if (itemPca == null || itemPca.trim().isEmpty()) {
            errors.add("Item do PCA é obrigatório");
        } else if (itemPca.length() > 50) {
            errors.add("Item do PCA deve ter no máximo 50 caracteres");
        }
        String area = str(data.get("area_demandante"));
        if (area != null && area.length() > 100) {
            errors.add("Área demandante deve ter no máximo 100 caracteres");
        }
        String objeto = str(data.get("objeto"));
        if (valorEstimado == null || valorEstimado.isNaN() || valorEstimado <= 0) {
            errors.add("Valor anual deve ser um número positivo maior que zero");
        }
        String dataEst = str(data.get("data_estimada_contratacao"));
        if (dataEst == null || dataEst.trim().isEmpty()) {
            errors.add("Data estimada de contratação é obrigatória");
        }
        String status = str(data.get("status"));
        if (status != null && !STATUS_ITEM.contains(status)) {
            errors.add("Status inválido. Use: Concluída, Em andamento ou Não Iniciada");
        }
        if (!errors.isEmpty()) {
            return ResponseEntity.status(400).body(erroDetails("Dados inválidos", errors));
        }
        Map<String, Object> created = pcaService.create(data, userId(req, body));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<?> update(HttpServletRequest req, @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req, body);
        Map<String, Object> data = new LinkedHashMap<>();
        if (body.containsKey("item_pca"))
            data.put("item_pca", body.get("item_pca"));
        if (body.containsKey("tipo"))
            data.put("tipo", body.get("tipo"));
        if (body.containsKey("area_demandante"))
            data.put("area_demandante", body.get("area_demandante"));
        if (body.containsKey("objeto"))
            data.put("objeto", body.get("objeto"));
        if (body.containsKey("valor_estimado"))
            data.put("valor_estimado", parseFloatJs(body.get("valor_estimado")));
        if (body.containsKey("valor_formalizado"))
            data.put("valor_formalizado", parseFloatJs(body.get("valor_formalizado")));
        if (body.containsKey("data_estimada_contratacao"))
            data.put("data_estimada_contratacao", body.get("data_estimada_contratacao"));
        if (body.containsKey("status"))
            data.put("status", body.get("status"));
        if (body.containsKey("ano"))
            data.put("ano", parseIntJs(body.get("ano")));
        // Novos campos FK para diretoria/área
        if (body.containsKey("id_diretoria"))
            data.put("id_diretoria", body.get("id_diretoria"));
        if (body.containsKey("id_area_demandante"))
            data.put("id_area_demandante", body.get("id_area_demandante"));
        if (body.containsKey("process"))
            data.put("process", body.get("process"));
        if (body.containsKey("description"))
            data.put("description", body.get("description"));
        if (body.containsKey("justification"))
            data.put("justification", body.get("justification"));
        if (body.containsKey("financial_resource_type"))
            data.put("financial_resource_type", body.get("financial_resource_type"));
        if (body.containsKey("priority"))
            data.put("priority", body.get("priority"));
        if (body.containsKey("step"))
            data.put("step", body.get("step"));

        List<String> errors = new ArrayList<>();
        if (data.containsKey("item_pca")) {
            String v = str(data.get("item_pca"));
            if (v == null || v.trim().isEmpty())
                errors.add("Item do PCA não pode ser vazio");
            else if (v.length() > 50)
                errors.add("Item do PCA deve ter no máximo 50 caracteres");
        }
        if (data.containsKey("area_demandante")) {
            String v = str(data.get("area_demandante"));
            if (v != null && v.length() > 100)
                errors.add("Área demandante deve ter no máximo 100 caracteres");
        }
        if (data.containsKey("objeto")) {
            String v = str(data.get("objeto"));
        }
        if (data.containsKey("valor_estimado")) {
            Double ve = (Double) data.get("valor_estimado");
            if (ve == null || ve.isNaN() || ve <= 0)
                errors.add("Valor anual deve ser um número positivo maior que zero");
        }
        if (data.containsKey("data_estimada_contratacao")) {
            String v = str(data.get("data_estimada_contratacao"));
            if (v == null || v.trim().isEmpty())
                errors.add("Data estimada de contratação não pode ser vazia");
        }
        if (data.containsKey("status")) {
            String v = str(data.get("status"));
            if (v != null && !STATUS_ITEM.contains(v))
                errors.add("Status inválido. Use: Concluída, Em andamento ou Não Iniciada");
        }
        if (!errors.isEmpty()) {
            return ResponseEntity.status(400).body(erroDetails("Dados inválidos", errors));
        }
        Map<String, Object> updated = pcaService.update(id, data, userId(req, body));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Item PCA não encontrado"));
        }
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id:\\d+}/status")
    public ResponseEntity<?> updateStatusItem(HttpServletRequest req, @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        requireGestorOrAdmin(req, body);
        String status = str(body.get("status"));
        if (status == null || !STATUS_ITEM.contains(status)) {
            return ResponseEntity.status(400)
                    .body(erroDetails("Status inválido", List.of("Use: Concluída, Em andamento ou Não Iniciada")));
        }
        Map<String, Object> updated = pcaService.updateStatus(id, status, userId(req, body));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Item PCA não encontrado"));
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<?> delete(HttpServletRequest req, @PathVariable long id) {
        requireGestorOrAdmin(req, null);
        if (!pcaService.softDelete(id, userId(req, null))) {
            return ResponseEntity.status(404).body(err("Item PCA não encontrado"));
        }
        return ResponseEntity.ok(Map.of("message", "Item PCA excluído com sucesso"));
    }

    // ============================================================
    // DETALHES (pca-details.ts)
    // ============================================================

    @GetMapping("/{id:\\d+}/details")
    public ResponseEntity<?> getDetails(@PathVariable long id) {
        requireItem(id);
        Map<String, Object> details = detailsService.getDetails(id);
        if (details == null) {
            Map<String, Object> def = new LinkedHashMap<>();
            def.put("pca_item_id", id);
            def.put("validacao_dg_tipo", "Pendente");
            def.put("validacao_dg_data", null);
            def.put("fase_atual", null);
            return ResponseEntity.ok(def);
        }
        return ResponseEntity.ok(details);
    }

    @PutMapping("/{id:\\d+}/details")
    public ResponseEntity<?> putDetails(HttpServletRequest req, @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        requireItem(id);
        requireGestorOrAdmin(req, body);
        String tipo = str(body.get("validacao_dg_tipo"));
        if (tipo != null && !List.of("Pendente", "Data").contains(tipo)) {
            return ResponseEntity.status(400).body(err("Tipo de validação DG inválido. Use: Pendente ou Data"));
        }
        String fase = str(body.get("fase_atual"));
        if (fase != null && fase.length() > 20) {
            return ResponseEntity.status(400).body(err("Fase atual deve ter no máximo 20 caracteres"));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("validacao_dg_tipo", body.get("validacao_dg_tipo"));
        data.put("validacao_dg_data", body.get("validacao_dg_data"));
        data.put("fase_atual", body.get("fase_atual"));
        return ResponseEntity.ok(detailsService.upsertDetails(id, data, userId(req, body)));
    }

    // ---------- CHECKLIST ----------

    @GetMapping("/{id:\\d+}/checklist")
    public ResponseEntity<?> getChecklist(@PathVariable long id) {
        requireItem(id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", detailsService.getChecklist(id));
        out.put("progress", detailsService.getChecklistProgress(id));
        return ResponseEntity.ok(out);
    }

    @PatchMapping("/{id:\\d+}/checklist/{checklistId:\\d+}/status")
    public ResponseEntity<?> updateChecklist(HttpServletRequest req, @PathVariable long id,
            @PathVariable long checklistId, @RequestBody Map<String, Object> body) {
        requireItem(id);
        requireGestorOrAdmin(req, body);
        String status = str(body.get("status"));
        if (status == null || !STATUS_ITEM.contains(status)) {
            return ResponseEntity.status(400)
                    .body(erroDetails("Status inválido", List.of("Use: Concluída, Em andamento ou Não Iniciada")));
        }
        Map<String, Object> updated = detailsService.updateChecklistItemStatus(checklistId, status, userId(req, body));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Item do checklist não encontrado"));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("item", updated);
        out.put("progress", detailsService.getChecklistProgress(id));
        return ResponseEntity.ok(out);
    }

    // ---------- PONTOS DE CONTROLE ----------

    @GetMapping("/{id:\\d+}/pontos-controle")
    public ResponseEntity<?> getPontosControle(@PathVariable long id) {
        requireItem(id);
        return ResponseEntity.ok(detailsService.getPontosControle(id));
    }

    @PostMapping("/{id:\\d+}/pontos-controle")
    public ResponseEntity<?> createPontoControle(HttpServletRequest req, @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        requireItem(id);
        requireGestorOrAdmin(req, body);
        if (isBlank(body.get("ponto_controle"))) {
            return ResponseEntity.status(400).body(err("Ponto de controle é obrigatório"));
        }
        if (body.get("data") == null) {
            return ResponseEntity.status(400).body(err("Data é obrigatória"));
        }
        if (body.get("proxima_reuniao") == null) {
            return ResponseEntity.status(400).body(err("Próxima reunião é obrigatória"));
        }
        Map<String, Object> created = detailsService.createPontoControle(id, body, userId(req, body));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id:\\d+}/pontos-controle/{pcId:\\d+}")
    public ResponseEntity<?> updatePontoControle(HttpServletRequest req, @PathVariable long id,
            @PathVariable long pcId, @RequestBody Map<String, Object> body) {
        requireItem(id);
        requireGestorOrAdmin(req, body);
        Map<String, Object> updated = detailsService.updatePontoControle(pcId, body, userId(req, body));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Ponto de controle não encontrado"));
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id:\\d+}/pontos-controle/{pcId:\\d+}")
    public ResponseEntity<?> deletePontoControle(HttpServletRequest req, @PathVariable long id, @PathVariable long pcId,
            @RequestParam(value = "deleteTarefas", required = false) String deleteTarefas) {
        requireItem(id);
        requireGestorOrAdmin(req, null);
        boolean del = "true".equals(deleteTarefas);
        Map<String, Object> result = detailsService.deletePontoControle(pcId, userId(req, null), del);
        if (!Boolean.TRUE.equals(result.get("success"))) {
            return ResponseEntity.status(404).body(err("Ponto de controle não encontrado"));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("message", "Ponto de controle excluído com sucesso");
        out.put("tarefas_afetadas", result.get("tarefasAfetadas"));
        out.put("tarefas_deletadas", del);
        return ResponseEntity.ok(out);
    }

    @GetMapping("/{id:\\d+}/pontos-controle-com-tarefas")
    public ResponseEntity<?> pontosControleComTarefas(@PathVariable long id) {
        requireItem(id);
        return ResponseEntity.ok(detailsService.getPontosControleComTarefas(id));
    }

    @GetMapping("/{id:\\d+}/tarefas-orfas")
    public ResponseEntity<?> tarefasOrfas(@PathVariable long id) {
        requireItem(id);
        return ResponseEntity.ok(detailsService.getTarefasOrfas(id));
    }

    // ---------- TAREFAS ----------

    @GetMapping("/{id:\\d+}/tarefas")
    public ResponseEntity<?> getTarefas(@PathVariable long id) {
        requireItem(id);
        return ResponseEntity.ok(detailsService.getTarefas(id));
    }

    @PostMapping("/{id:\\d+}/tarefas")
    public ResponseEntity<?> createTarefa(HttpServletRequest req, @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        requireItem(id);
        requireGestorOrAdmin(req, body);
        if (isBlank(body.get("tarefa"))) {
            return ResponseEntity.status(400).body(err("Tarefa é obrigatória"));
        }
        if (isBlank(body.get("responsavel"))) {
            return ResponseEntity.status(400).body(err("Responsável é obrigatório"));
        }
        if (body.get("prazo") == null) {
            return ResponseEntity.status(400).body(err("Prazo é obrigatório"));
        }
        Map<String, Object> data = new LinkedHashMap<>(body);
        data.put("ponto_controle_id", body.get("ponto_controle_id") != null ? body.get("ponto_controle_id") : null);
        Map<String, Object> created = detailsService.createTarefa(id, data, userId(req, body));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id:\\d+}/tarefas/{tarefaId:\\d+}")
    public ResponseEntity<?> updateTarefa(HttpServletRequest req, @PathVariable long id,
            @PathVariable long tarefaId, @RequestBody Map<String, Object> body) {
        requireItem(id);
        requireGestorOrAdmin(req, body);
        Map<String, Object> updated = detailsService.updateTarefa(tarefaId, body, userId(req, body));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Tarefa não encontrada"));
        }
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id:\\d+}/tarefas/{tarefaId:\\d+}/associar-pc")
    public ResponseEntity<?> associarPc(HttpServletRequest req, @PathVariable long id,
            @PathVariable long tarefaId, @RequestBody Map<String, Object> body) {
        requireItem(id);
        requireGestorOrAdmin(req, body);
        Object pcId = body.containsKey("ponto_controle_id") ? body.get("ponto_controle_id") : null;
        Map<String, Object> updated = detailsService.associarTarefaAPontoControle(tarefaId, pcId, userId(req, body));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Tarefa não encontrada"));
        }
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id:\\d+}/tarefas/{tarefaId:\\d+}/status")
    public ResponseEntity<?> updateTarefaStatus(HttpServletRequest req, @PathVariable long id,
            @PathVariable long tarefaId, @RequestBody Map<String, Object> body) {
        requireItem(id);
        requireGestorOrAdmin(req, body);
        String status = str(body.get("status"));
        if (status == null || !STATUS_TAREFA.contains(status)) {
            return ResponseEntity.status(400)
                    .body(erroDetails("Status inválido", List.of("Use: Não iniciada, Em andamento ou Concluída")));
        }
        Map<String, Object> updated = detailsService.updateTarefaStatus(tarefaId, status, userId(req, body));
        if (updated == null) {
            return ResponseEntity.status(404).body(err("Tarefa não encontrada"));
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id:\\d+}/tarefas/{tarefaId:\\d+}")
    public ResponseEntity<?> deleteTarefa(HttpServletRequest req, @PathVariable long id, @PathVariable long tarefaId) {
        requireItem(id);
        requireGestorOrAdmin(req, null);
        if (!detailsService.deleteTarefa(tarefaId, userId(req, null))) {
            return ResponseEntity.status(404).body(err("Tarefa não encontrada"));
        }
        return ResponseEntity.ok(Map.of("message", "Tarefa excluída com sucesso"));
    }

    @GetMapping("/{id:\\d+}/all-details")
    public ResponseEntity<?> allDetails(@PathVariable long id) {
        Map<String, Object> item = requireItem(id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pcaItem", item);
        out.putAll(detailsService.getAllData(id));
        return ResponseEntity.ok(out);
    }

    @PatchMapping("/{id:\\d+}/save-all-changes")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> saveAllChanges(HttpServletRequest req, @PathVariable long id,
            @RequestBody Map<String, Object> body) {
        requireItem(id);
        requireGestorOrAdmin(req, body);
        Map<String, Object> details = body.get("details") instanceof Map ? (Map<String, Object>) body.get("details")
                : null;
        List<Map<String, Object>> checklist = body.get("checklist_updates") instanceof List
                ? (List<Map<String, Object>>) body.get("checklist_updates")
                : null;
        List<Map<String, Object>> tarefas = body.get("tarefas_updates") instanceof List
                ? (List<Map<String, Object>>) body.get("tarefas_updates")
                : null;

        if (body.containsKey("details") && !(body.get("details") instanceof Map) && body.get("details") != null) {
            // segue (Node não valida tipo aqui)
        }
        if (body.get("checklist_updates") != null && !(body.get("checklist_updates") instanceof List)) {
            return ResponseEntity.status(400).body(successErr("checklist_updates deve ser um array"));
        }
        if (body.get("tarefas_updates") != null && !(body.get("tarefas_updates") instanceof List)) {
            return ResponseEntity.status(400).body(successErr("tarefas_updates deve ser um array"));
        }
        // validações de details (mesma mensagem do Node, mas com success:false)
        if (details != null) {
            String tipo = str(details.get("validacao_dg_tipo"));
            if (tipo != null && !List.of("Pendente", "Data").contains(tipo)) {
                return ResponseEntity.status(400)
                        .body(successErr("Tipo de validação DG inválido. Use: Pendente ou Data"));
            }
            if ("Data".equals(tipo) && details.get("validacao_dg_data") == null) {
                return ResponseEntity.status(400)
                        .body(successErr("Data da validação é obrigatória quando tipo é \"Data\""));
            }
            String fase = str(details.get("fase_atual"));
            if (fase != null && fase.length() > 20) {
                return ResponseEntity.status(400).body(successErr("Fase atual deve ter no máximo 20 caracteres"));
            }
        }
        boolean hasDetails = details != null && !details.isEmpty();
        boolean hasChecklist = checklist != null && !checklist.isEmpty();
        boolean hasTarefas = tarefas != null && !tarefas.isEmpty();
        if (!hasDetails && !hasChecklist && !hasTarefas) {
            return ResponseEntity.status(400).body(successErr("Nenhuma alteração para salvar"));
        }
        return ResponseEntity.ok(detailsService.saveAllChanges(id, details, checklist, tarefas, userId(req, body)));
    }

    // ---------- helpers ----------

    private static Map<String, Object> err(String error) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", error);
        return m;
    }

    private static Map<String, Object> erroDetails(String error, List<String> details) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", error);
        m.put("details", details);
        return m;
    }

    private static Map<String, Object> successErr(String error) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", false);
        m.put("error", error);
        return m;
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static boolean isBlank(Object v) {
        return v == null || String.valueOf(v).trim().isEmpty();
    }

    private static Double parseFloatJs(Object v) {
        if (v == null) {
            return Double.NaN;
        }
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }

    private static Integer parseIntJs(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
