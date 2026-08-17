package br.jus.tjgo.kaizen.service.home;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Uma pendência do usuário exibida na Home ("central de pendências").
 *
 * <p>Os campos {@code tipo/label/count/link/color} preservam o contrato histórico consumido pelo
 * frontend; {@code categoria} e {@code prioridade} enriquecem o agrupamento e a ordenação — são
 * aditivos, então clientes antigos simplesmente os ignoram.</p>
 *
 * <p>Convenção de {@code prioridade}: menor = mais urgente / aparece primeiro.</p>
 */
public record Pendencia(
        String tipo,
        String label,
        int count,
        String link,
        String color,
        String categoria,
        int prioridade,
        // Itens individuais da pendência (id, descricao, link). Quando há mais de um, a Home
        // expande e oferece "Ir para pendência" por item. Opcional — vazio = comportamento antigo.
        List<Map<String, Object>> itens
) {

    // ── Categorias (agrupamento visual na Home) ──
    public static final String CAT_PESSOAS = "Pessoas";
    public static final String CAT_PROJETOS = "Projetos";
    public static final String CAT_PROCESSOS = "Processos";
    public static final String CAT_GERAL = "Geral";

    // ── Faixas de prioridade (menor = mais urgente) ──
    /** Algo foi recusado/devolvido e precisa de retrabalho seu — bloqueia o fluxo. */
    public static final int PRIO_DEVOLVIDO = 10;
    /** Prazo vencido (ex.: revisão de processo vencida). */
    public static final int PRIO_VENCIDO = 20;
    /** Uma validação sua está pendente (ação sua trava a esteira de outra pessoa). */
    public static final int PRIO_VALIDACAO = 30;
    /** Handoff: um editor precisa concluir, ou algo foi passado adiante e aguarda você. */
    public static final int PRIO_HANDOFF = 40;
    /** Informativo / acompanhamento. */
    public static final int PRIO_INFO = 60;

    public Pendencia {
        if (count < 0) count = 0;
        if (categoria == null || categoria.isBlank()) categoria = CAT_GERAL;
        if (color == null || color.isBlank()) color = "slate";
        if (itens == null) itens = List.of();
    }

    /** Construtor compatível (sem itens) — preserva as chamadas antigas dos providers. */
    public Pendencia(String tipo, String label, int count, String link, String color,
                     String categoria, int prioridade) {
        this(tipo, label, count, link, color, categoria, prioridade, List.of());
    }

    /** Serializa preservando a ordem dos campos (paridade com o payload antigo + novos campos). */
    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tipo", tipo);
        m.put("label", label);
        m.put("count", count);
        m.put("link", link);
        m.put("color", color);
        m.put("categoria", categoria);
        m.put("prioridade", prioridade);
        m.put("itens", itens);
        return m;
    }
}
