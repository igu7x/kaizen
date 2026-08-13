package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.AuthenticatedUser;
import br.jus.tjgo.kaizen.service.SgsiAtaService;
import br.jus.tjgo.kaizen.service.SgsiAuditoriaService;
import br.jus.tjgo.kaizen.service.SgsiConfiguracaoService;
import br.jus.tjgo.kaizen.service.SgsiLeituraService;
import br.jus.tjgo.kaizen.service.SgsiDocumentoService;
import br.jus.tjgo.kaizen.service.SgsiEmissaoService;
import br.jus.tjgo.kaizen.service.SgsiFrameworkService;
import br.jus.tjgo.kaizen.service.SgsiIndicadorService;
import br.jus.tjgo.kaizen.service.SgsiInstrumentoService;
import br.jus.tjgo.kaizen.service.SgsiMatrizService;
import br.jus.tjgo.kaizen.service.SgsiPainelService;
import br.jus.tjgo.kaizen.service.SgsiProcessoService;
import br.jus.tjgo.kaizen.service.SgsiRelatorioService;
import br.jus.tjgo.kaizen.service.SgsiRiscoService;
import br.jus.tjgo.kaizen.service.SgsiTarefaService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Módulo "Segurança da Informação" (SGSI) — 1ª fatia: Instrumentos Normativos + Tarefas 5W2H.
 * Categoria B (strict): exige auth. Enquanto o mapeamento de perfis do SGSI (Admin/Gestor/
 * Colaborador/Auditor/Leitor) não é definido, o módulo inteiro fica restrito a superadmin.
 */
@RestController
@RequestMapping("/api/sgsi")
@RequiredArgsConstructor
public class SgsiController {

    private final SgsiInstrumentoService instrumentos;
    private final SgsiTarefaService tarefas;
    private final SgsiDocumentoService documentos;
    private final SgsiIndicadorService indicadores;
    private final SgsiFrameworkService frameworks;
    private final SgsiRiscoService riscos;
    private final SgsiMatrizService matriz;
    private final SgsiEmissaoService emissoes;
    private final SgsiRelatorioService relatorios;
    private final SgsiAtaService atas;
    private final SgsiProcessoService processos;
    private final SgsiConfiguracaoService configuracoes;
    private final SgsiLeituraService leitura;
    private final SgsiAuditoriaService auditoria;
    private final SgsiPainelService painel;

    /** Guarda provisória: só superadmin. Retorna null se ok, ou a resposta de erro (401/403). */
    private ResponseEntity<?> guard() {
        AuthenticatedUser u = AuthContext.getCurrentUser().orElse(null);
        if (u == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!u.isSuperadmin()) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso restrito ao módulo de Segurança da Informação."));
        }
        return null;
    }

    private Long userId() {
        return AuthContext.getCurrentUser().map(AuthenticatedUser::id).orElse(null);
    }

    // GET /api/sgsi/frameworks
    @GetMapping("/frameworks")
    public ResponseEntity<?> listarFrameworks() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(frameworks.listarFrameworks());
    }

    // GET /api/sgsi/frameworks/{codigo}/itens
    @GetMapping("/frameworks/{codigo}/itens")
    public ResponseEntity<?> listarItensFramework(@PathVariable String codigo) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(frameworks.listarItens(codigo));
    }

    // PUT /api/sgsi/frameworks/itens/{itemId}/avaliacao — { status, observacao }
    @PutMapping("/frameworks/itens/{itemId:\\d+}/avaliacao")
    public ResponseEntity<?> avaliarItemFramework(@PathVariable long itemId, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        String status = body == null ? null : str(body.get("status"));
        String observacao = body == null ? null : str(body.get("observacao"));
        try {
            Map<String, Object> item = frameworks.avaliarItem(itemId, status, observacao, userId());
            if (item == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Item não encontrado"));
            }
            return ResponseEntity.ok(item);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // GET /api/sgsi/riscos
    @GetMapping("/riscos")
    public ResponseEntity<?> listarRiscos() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(riscos.listar());
    }

    // POST /api/sgsi/riscos
    @PostMapping("/riscos")
    public ResponseEntity<?> criarRisco(@RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        try {
            return ResponseEntity.status(201).body(riscos.criar(body == null ? Map.of() : body, userId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // PUT /api/sgsi/riscos/{id}
    @PutMapping("/riscos/{id:\\d+}")
    public ResponseEntity<?> atualizarRisco(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        try {
            Map<String, Object> r = riscos.atualizar(id, body == null ? Map.of() : body, userId());
            if (r == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Risco não encontrado"));
            }
            return ResponseEntity.ok(r);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // DELETE /api/sgsi/riscos/{id}
    @DeleteMapping("/riscos/{id:\\d+}")
    public ResponseEntity<?> deletarRisco(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        if (!riscos.deletar(id, userId())) {
            return ResponseEntity.status(404).body(Map.of("error", "Risco não encontrado"));
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    // GET /api/sgsi/series
    @GetMapping("/series")
    public ResponseEntity<?> listarSeries() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(emissoes.listarSeries());
    }

    // GET /api/sgsi/emissoes
    @GetMapping("/emissoes")
    public ResponseEntity<?> listarEmissoes() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(emissoes.listarEmissoes());
    }

    // POST /api/sgsi/emissoes — emitir documento numerado
    @PostMapping("/emissoes")
    public ResponseEntity<?> emitir(@RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        try {
            return ResponseEntity.status(201).body(emissoes.emitir(body == null ? Map.of() : body, userId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // PUT /api/sgsi/emissoes/{id}/digitalizacao — { nome, mime, conteudo (base64) }
    @PutMapping("/emissoes/{id:\\d+}/digitalizacao")
    public ResponseEntity<?> digitalizar(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        try {
            Map<String, Object> e = emissoes.anexarDigitalizacao(id,
                    str(body == null ? null : body.get("nome")),
                    str(body == null ? null : body.get("mime")),
                    str(body == null ? null : body.get("conteudo")), userId());
            if (e == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Emissão não encontrada"));
            }
            return ResponseEntity.ok(e);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(Map.of("error", ex.getMessage()));
        }
    }

    // GET /api/sgsi/emissoes/{id}/digitalizacao — conteúdo do PDF
    @GetMapping("/emissoes/{id:\\d+}/digitalizacao")
    public ResponseEntity<?> getDigitalizacao(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        Map<String, Object> a = emissoes.getDigitalizacao(id);
        if (a == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Sem digitalização"));
        }
        return ResponseEntity.ok(a);
    }

    // PATCH /api/sgsi/emissoes/{id}/cancelar — { motivo }
    @PatchMapping("/emissoes/{id:\\d+}/cancelar")
    public ResponseEntity<?> cancelarEmissao(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        try {
            Map<String, Object> e = emissoes.cancelar(id, str(body == null ? null : body.get("motivo")), userId());
            if (e == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Emissão não encontrada"));
            }
            return ResponseEntity.ok(e);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(Map.of("error", ex.getMessage()));
        }
    }

    // GET /api/sgsi/processos
    @GetMapping("/processos")
    public ResponseEntity<?> listarProcessos() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(processos.listar());
    }

    // GET /api/sgsi/processos/{id}
    @GetMapping("/processos/{id}")
    public ResponseEntity<?> buscarProcesso(@PathVariable String id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        Map<String, Object> p = processos.buscar(id);
        if (p == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Processo não encontrado"));
        }
        return ResponseEntity.ok(p);
    }

    // GET /api/sgsi/atas
    @GetMapping("/atas")
    public ResponseEntity<?> listarAtas() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(atas.listar());
    }

    // POST /api/sgsi/atas
    @PostMapping("/atas")
    public ResponseEntity<?> criarAta(@RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        try {
            return ResponseEntity.status(201).body(atas.criar(body == null ? Map.of() : body, userId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // PUT /api/sgsi/atas/{id}
    @PutMapping("/atas/{id:\\d+}")
    public ResponseEntity<?> atualizarAta(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        try {
            Map<String, Object> a = atas.atualizar(id, body == null ? Map.of() : body, userId());
            if (a == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Ata não encontrada"));
            }
            return ResponseEntity.ok(a);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // DELETE /api/sgsi/atas/{id}
    @DeleteMapping("/atas/{id:\\d+}")
    public ResponseEntity<?> deletarAta(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        if (!atas.deletar(id, userId())) {
            return ResponseEntity.status(404).body(Map.of("error", "Ata não encontrada"));
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    // GET /api/sgsi/relatorios/catalogo — modelos de relatório do SGSI
    @GetMapping("/relatorios/catalogo")
    public ResponseEntity<?> catalogoRelatorios() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(relatorios.listarCatalogo());
    }

    // GET /api/sgsi/relatorios/pendencias — modelos obrigatórios sem emissão no ano corrente (RN-36)
    @GetMapping("/relatorios/pendencias")
    public ResponseEntity<?> pendenciasRelatorios() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(relatorios.pendencias());
    }

    // GET /api/sgsi/relatorios — relatórios já emitidos
    @GetMapping("/relatorios")
    public ResponseEntity<?> listarRelatorios() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(relatorios.listarEmitidos());
    }

    // GET /api/sgsi/relatorios/{id} — relatório emitido com o retrato dos indicadores
    @GetMapping("/relatorios/{id:\\d+}")
    public ResponseEntity<?> buscarRelatorio(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        Map<String, Object> r = relatorios.buscar(id);
        if (r == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Relatório não encontrado"));
        }
        return ResponseEntity.ok(r);
    }

    // POST /api/sgsi/relatorios — emite um relatório (aloca número REL + congela indicadores)
    @PostMapping("/relatorios")
    public ResponseEntity<?> emitirRelatorio(@RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        try {
            return ResponseEntity.status(201).body(relatorios.emitir(body == null ? Map.of() : body, userId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // GET /api/sgsi/matriz — matriz de rastreabilidade consolidada
    @GetMapping("/matriz")
    public ResponseEntity<?> matriz() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(matriz.listar());
    }

    // GET /api/sgsi/painel — visão executiva agregada
    @GetMapping("/painel")
    public ResponseEntity<?> painel() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(painel.resumo());
    }

    // GET /api/sgsi/auditoria?acao=&tabela=&busca=&limite= — trilha de auditoria do módulo
    @GetMapping("/auditoria")
    public ResponseEntity<?> auditoria(
            @RequestParam(value = "acao", required = false) String acao,
            @RequestParam(value = "tabela", required = false) String tabela,
            @RequestParam(value = "busca", required = false) String busca,
            @RequestParam(value = "limite", required = false) Integer limite) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(auditoria.listar(acao, tabela, busca, limite));
    }

    // GET /api/sgsi/auditoria/facetas — ações e tabelas distintas para os filtros
    @GetMapping("/auditoria/facetas")
    public ResponseEntity<?> auditoriaFacetas() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(auditoria.facetas());
    }

    // ─── Ciência e Leitura Confirmada ───────────────────────────────────────────────────────────

    // GET /api/sgsi/leitura — panorama de ciência por instrumento
    @GetMapping("/leitura")
    public ResponseEntity<?> leituraPanorama() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(leitura.panorama(userId()));
    }

    // GET /api/sgsi/leitura/{codigo} — leitores exigidos e suas confirmações
    @GetMapping("/leitura/{codigo}")
    public ResponseEntity<?> leituraDetalhe(@PathVariable String codigo) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        Map<String, Object> d = leitura.detalhe(codigo);
        if (d == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Instrumento não encontrado"));
        }
        return ResponseEntity.ok(d);
    }

    // PUT /api/sgsi/leitura/{codigo}/requisitos — define os leitores exigidos { usuario_ids: [] }
    @PutMapping("/leitura/{codigo}/requisitos")
    public ResponseEntity<?> leituraRequisitos(@PathVariable String codigo, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        List<Long> ids = new ArrayList<>();
        Object raw = body == null ? null : body.get("usuario_ids");
        if (raw instanceof List<?> list) {
            for (Object o : list) {
                if (o == null) continue;
                try {
                    ids.add(Long.parseLong(String.valueOf(o).trim()));
                } catch (NumberFormatException ignored) {
                    // ignora ids inválidos
                }
            }
        }
        Map<String, Object> d = leitura.definirRequisitos(codigo, ids, userId());
        if (d == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Instrumento não encontrado"));
        }
        return ResponseEntity.ok(d);
    }

    // POST /api/sgsi/leitura/{codigo}/confirmar — confirma a leitura do usuário atual
    @PostMapping("/leitura/{codigo}/confirmar")
    public ResponseEntity<?> leituraConfirmar(@PathVariable String codigo, HttpServletRequest req) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        Map<String, Object> d = leitura.confirmar(codigo, userId(), ipDe(req));
        if (d == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Instrumento não encontrado"));
        }
        return ResponseEntity.ok(d);
    }

    private static String ipDe(HttpServletRequest req) {
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            return fwd.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }

    // GET /api/sgsi/instrumentos
    @GetMapping("/instrumentos")
    public ResponseEntity<?> listarInstrumentos() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(instrumentos.listar());
    }

    // GET /api/sgsi/instrumentos/{codigo}
    @GetMapping("/instrumentos/{codigo}")
    public ResponseEntity<?> buscarInstrumento(@PathVariable String codigo) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        Map<String, Object> inst = instrumentos.buscar(codigo);
        if (inst == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Instrumento não encontrado"));
        }
        return ResponseEntity.ok(inst);
    }

    // GET /api/sgsi/instrumentos/{codigo}/tarefas
    @GetMapping("/instrumentos/{codigo}/tarefas")
    public ResponseEntity<?> listarTarefas(@PathVariable String codigo) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        List<Map<String, Object>> lista = tarefas.listarPorInstrumento(codigo);
        return ResponseEntity.ok(lista);
    }

    // GET /api/sgsi/documentos?instrumento=&status=&tipo=
    @GetMapping("/documentos")
    public ResponseEntity<?> listarDocumentos(
            @RequestParam(value = "instrumento", required = false) String instrumento,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "tipo", required = false) String tipo) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(documentos.listar(instrumento, status, tipo));
    }

    // GET /api/sgsi/documentos/{id}
    @GetMapping("/documentos/{id:\\d+}")
    public ResponseEntity<?> buscarDocumento(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        Map<String, Object> doc = documentos.buscar(id);
        if (doc == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Documento não encontrado"));
        }
        return ResponseEntity.ok(doc);
    }

    // PATCH /api/sgsi/documentos/{id} — { status }
    @PatchMapping("/documentos/{id:\\d+}")
    public ResponseEntity<?> atualizarDocumento(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        String status = body == null ? null : str(body.get("status"));
        try {
            Map<String, Object> atualizado = documentos.atualizarStatus(id, status, userId());
            if (atualizado == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Documento não encontrado"));
            }
            return ResponseEntity.ok(atualizado);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // ─── Workflow do documento: checkout, versões e assinatura ──────────────────────────────────

    // POST /api/sgsi/documentos/{id}/checkout — assume a edição exclusiva
    @PostMapping("/documentos/{id:\\d+}/checkout")
    public ResponseEntity<?> assumirEdicao(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return exec(() -> documentos.assumirEdicao(id, userId()), "Documento não encontrado");
    }

    // DELETE /api/sgsi/documentos/{id}/checkout?forcar= — libera o checkout
    @DeleteMapping("/documentos/{id:\\d+}/checkout")
    public ResponseEntity<?> liberarEdicao(@PathVariable long id,
            @RequestParam(value = "forcar", required = false, defaultValue = "false") boolean forcar) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return exec(() -> documentos.liberarEdicao(id, userId(), forcar), "Documento não encontrado");
    }

    // POST /api/sgsi/documentos/{id}/versoes — grava nova versão do conteúdo { conteudo }
    @PostMapping("/documentos/{id:\\d+}/versoes")
    public ResponseEntity<?> gravarVersao(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        String conteudo = body == null ? null : str(body.get("conteudo"));
        return exec(() -> documentos.gravarVersao(id, conteudo, userId()), "Documento não encontrado");
    }

    // GET /api/sgsi/documentos/{id}/versoes — histórico de versões
    @GetMapping("/documentos/{id:\\d+}/versoes")
    public ResponseEntity<?> listarVersoes(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(documentos.listarVersoes(id));
    }

    // GET /api/sgsi/documentos/{id}/versoes/vigente — conteúdo da versão vigente
    @GetMapping("/documentos/{id:\\d+}/versoes/vigente")
    public ResponseEntity<?> versaoVigente(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        Map<String, Object> v = documentos.buscarVersao(id, null);
        return ResponseEntity.ok(v == null ? Map.of() : v);
    }

    // GET /api/sgsi/documentos/{id}/versoes/{numero} — conteúdo de uma versão específica
    @GetMapping("/documentos/{id:\\d+}/versoes/{numero:\\d+}")
    public ResponseEntity<?> versao(@PathVariable long id, @PathVariable int numero) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        Map<String, Object> v = documentos.buscarVersao(id, numero);
        if (v == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Versão não encontrada"));
        }
        return ResponseEntity.ok(v);
    }

    // GET /api/sgsi/documentos/{id}/assinaturas — assinaturas registradas
    @GetMapping("/documentos/{id:\\d+}/assinaturas")
    public ResponseEntity<?> listarAssinaturas(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(documentos.listarAssinaturas(id));
    }

    // POST /api/sgsi/documentos/{id}/assinaturas — assina a versão vigente
    @PostMapping("/documentos/{id:\\d+}/assinaturas")
    public ResponseEntity<?> assinar(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return exec(() -> documentos.assinar(id, userId()), "Documento não encontrado");
    }

    // POST /api/sgsi/documentos/{id}/reabrir — reabre e invalida as assinaturas { motivo }
    @PostMapping("/documentos/{id:\\d+}/reabrir")
    public ResponseEntity<?> reabrirDocumento(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        String motivo = body == null ? null : str(body.get("motivo"));
        return exec(() -> documentos.reabrir(id, motivo, userId()), "Documento não encontrado");
    }

    /** Executa uma operação de workflow mapeando 404 (null), 409 (estado inválido) e 400 (argumento). */
    private ResponseEntity<?> exec(java.util.function.Supplier<Map<String, Object>> op, String notFound) {
        try {
            Map<String, Object> r = op.get();
            if (r == null) {
                return ResponseEntity.status(404).body(Map.of("error", notFound));
            }
            return ResponseEntity.ok(r);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // GET /api/sgsi/indicadores
    @GetMapping("/indicadores")
    public ResponseEntity<?> listarIndicadores() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(indicadores.listar());
    }

    // GET /api/sgsi/indicadores/{id}/medicoes
    @GetMapping("/indicadores/{id:\\d+}/medicoes")
    public ResponseEntity<?> listarMedicoes(@PathVariable long id) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(indicadores.listarMedicoes(id));
    }

    // POST /api/sgsi/indicadores/{id}/medicoes — { competencia (AAAA-MM), valor, observacao }
    @PostMapping("/indicadores/{id:\\d+}/medicoes")
    public ResponseEntity<?> registrarMedicao(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        String competencia = body == null ? null : str(body.get("competencia"));
        String observacao = body == null ? null : str(body.get("observacao"));
        java.math.BigDecimal valor = null;
        Object raw = body == null ? null : body.get("valor");
        if (raw != null) {
            try {
                valor = new java.math.BigDecimal(String.valueOf(raw));
            } catch (NumberFormatException e) {
                return ResponseEntity.status(400).body(Map.of("error", "valor deve ser numérico"));
            }
        }
        try {
            Map<String, Object> m = indicadores.registrarMedicao(id, competencia, valor, observacao, userId());
            if (m == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Indicador não encontrado"));
            }
            return ResponseEntity.status(201).body(m);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // PATCH /api/sgsi/tarefas/{id} — { status, percentual (0..1), observacao }
    @PatchMapping("/tarefas/{id:\\d+}")
    public ResponseEntity<?> atualizarTarefa(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        String status = body == null ? null : str(body.get("status"));
        String observacao = body == null ? null : str(body.get("observacao"));
        BigDecimal percentual = null;
        Object raw = body == null ? null : body.get("percentual");
        if (raw != null) {
            try {
                percentual = new BigDecimal(String.valueOf(raw));
            } catch (NumberFormatException e) {
                return ResponseEntity.status(400).body(Map.of("error", "percentual deve ser numérico (0 a 1)"));
            }
        }
        try {
            Map<String, Object> atualizada = tarefas.atualizar(id, status, percentual, observacao, userId());
            if (atualizada == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Tarefa não encontrada"));
            }
            return ResponseEntity.ok(atualizada);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    // GET /api/sgsi/configuracoes — parâmetros do SGSI (chave → valor JSON)
    @GetMapping("/configuracoes")
    public ResponseEntity<?> listarConfiguracoes() {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        return ResponseEntity.ok(configuracoes.listar());
    }

    // PUT /api/sgsi/configuracoes/{chave} — { valor (JSON) }
    @PutMapping("/configuracoes/{chave}")
    public ResponseEntity<?> atualizarConfiguracao(@PathVariable String chave, @RequestBody(required = false) Map<String, Object> body) {
        ResponseEntity<?> g = guard();
        if (g != null) return g;
        String valor = body == null ? null : str(body.get("valor"));
        try {
            Map<String, Object> c = configuracoes.atualizar(chave, valor, userId());
            if (c == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Configuração não encontrada"));
            }
            return ResponseEntity.ok(c);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(400).body(Map.of("error", e.getMessage()));
        }
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
