import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { areasApi } from "@/services/areasApi";
import {
  competenciasGestorApi,
  UnidadeAutorizada,
  CompetenciaPorUnidade,
} from "@/services/competenciasGestorApi";
import {
  avaliacaoIntegradaApi,
  AvaliacaoIntegradaFormulario,
  PessoaElegivel,
  ParData,
} from "@/services/avaliacaoIntegradaApi";
import {
  ESCALA_NOTAS,
  ESCALA_COMPORTAMENTAL,
  ESCALA_ESTRATEGICA,
  ESCALA_GERENCIAL,
  NOTA_COLORS,
  NOTA_TECNICA_LABELS,
  NOTA_COMPORTAMENTAL_LABELS,
  NOTA_ESTRATEGICA_LABELS,
  NOTA_GERENCIAL_LABELS,
} from "@/constants/competencias";
import { EscalaLegenda, EscalaRadioGroup } from "./EscalaUI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, Info, AlertCircle } from "lucide-react";

interface IntegradaRespostaState {
  competencia_unidade_id?: number;
  competencia_nome: string;
  competencia_descricao: string;
  /** null quando essa competência ainda não foi respondida na autoavaliação. */
  nota_autoavaliacao: number | null;
  /** null quando essa competência ainda não foi respondida na avaliação do gestor. */
  nota_gestor: number | null;
  nota_integrada: string;
  comentario: string;
  comentario_autoavaliacao: string;
  comentario_gestor: string;
  tipo: "tecnica" | "comportamental" | "estrategica" | "gerencial";
}

interface FormState {
  unidade_id: string;
  unidade_path: string[];
  pessoa_id: string;
  pessoa_nome: string;
  autoavaliacao_id: number | null;
  avaliacao_gestor_id: number | null;
  respostas: IntegradaRespostaState[];
}

interface AvaliacaoIntegradaFormProps {
  tipoInventario?: "equipe" | "gestor";
  onSubmitted?: (formulario: AvaliacaoIntegradaFormulario) => void;
  formularioEdit?: AvaliacaoIntegradaFormulario;
}

export function AvaliacaoIntegradaForm({
  onSubmitted,
  tipoInventario,
  formularioEdit,
}: AvaliacaoIntegradaFormProps) {
  const isEditMode = !!formularioEdit;
  const { user } = useAuth();

  const [unidadesAutorizadas, setUnidadesAutorizadas] = useState<
    UnidadeAutorizada[]
  >([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diretoriaUsuario, setDiretoriaUsuario] = useState<string>("");
  const [areaUsuarioId, setAreaUsuarioId] = useState<number | null>(null);

  const [elegiveis, setElegiveis] = useState<PessoaElegivel[]>([]);
  const [loadingElegiveis, setLoadingElegiveis] = useState(false);

  const [loadingParData, setLoadingParData] = useState(false);
  // Conjunto de chaves "nome|tipo" das competências que MUDARAM em relação à v1
  // (em modo edit). As inalteradas vêm travadas com nota_integrada da v1 preservada.
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const isItemChanged = (nome: string, tipo: string) =>
    changedKeys.has(`${nome}|${tipo || "tecnica"}`);

  const renderNotaBadge = (
    nota: number | null,
    labels: Record<number, string>,
  ) => {
    if (nota == null) {
      return (
        <Badge className="bg-gray-100 text-gray-500 italic">Sem resposta</Badge>
      );
    }
    return (
      <Badge className={NOTA_COLORS[nota] || "bg-gray-100 text-gray-700"}>
        {nota} — {labels[nota] || `Nota ${nota}`}
      </Badge>
    );
  };

  const [form, setForm] = useState<FormState>({
    unidade_id: "",
    unidade_path: [],
    pessoa_id: "",
    pessoa_nome: "",
    autoavaliacao_id: null,
    avaliacao_gestor_id: null,
    respostas: [],
  });

  // Handler para seleção de unidade
  const handleUnidadeSelect = (value: string) => {
    setForm((prev) => ({
      ...prev,
      unidade_id: value,
      unidade_path: [value],
      pessoa_id: "",
      pessoa_nome: "",
      autoavaliacao_id: null,
      avaliacao_gestor_id: null,
      respostas: [],
    }));
    setElegiveis([]);
    loadElegiveis(Number(value));
  };

  // Carregar pessoas elegiveis da unidade
  const loadElegiveis = async (unidadeId: number) => {
    setLoadingElegiveis(true);
    try {
      const data = await avaliacaoIntegradaApi.getElegiveis(
        unidadeId,
        tipoInventario || "equipe",
      );
      setElegiveis(data);
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingElegiveis(false);
    }
  };

  // Handler para selecao de pessoa elegivel
  const handlePessoaSelect = async (pessoaId: string) => {
    const pessoa = elegiveis.find((p) => String(p.pessoa_id) === pessoaId);
    if (!pessoa) return;

    setForm((prev) => ({
      ...prev,
      pessoa_id: pessoaId,
      pessoa_nome: pessoa.pessoa_nome,
      autoavaliacao_id: pessoa.autoavaliacao_id,
      avaliacao_gestor_id: pessoa.avaliacao_gestor_id,
      respostas: [],
    }));

    // Carregar dados das duas avaliacoes E a matriz de técnicas da unidade
    // (fonte de verdade para técnicas — não dependemos só das respostas).
    setLoadingParData(true);
    try {
      const unidadeId = Number(form.unidade_id);
      const [parData, tecnicasMatriz] = await Promise.all([
        avaliacaoIntegradaApi.getParData(
          pessoa.autoavaliacao_id,
          pessoa.avaliacao_gestor_id,
        ),
        unidadeId
          ? (tipoInventario === "gestor"
              ? competenciasGestorApi.getCompetenciasGestorPorUnidade(unidadeId)
              : competenciasGestorApi.getCompetenciasPorUnidade(unidadeId)
            ).catch(() => [] as CompetenciaPorUnidade[])
          : Promise.resolve([] as CompetenciaPorUnidade[]),
      ]);
      buildRespostas(parData, pessoa, tecnicasMatriz);
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingParData(false);
    }
  };

  // Construir respostas mescladas a partir dos dados do par.
  // tecnicasMatriz é a fonte de verdade das técnicas da unidade — todas devem
  // aparecer, mesmo que ausentes em uma das fontes (auto / gestor).
  const buildRespostas = (
    parData: ParData,
    pessoa: PessoaElegivel,
    tecnicasMatriz: CompetenciaPorUnidade[],
  ) => {
    if (!parData.autoavaliacao || !parData.avaliacaoGestor) {
      toast.error("Dados incompletos para a avaliação integrada.");
      return;
    }

    const autoRespostas = parData.autoavaliacao.respostas || [];
    const gestorRespostas = parData.avaliacaoGestor.respostas || [];

    // Criar mapa de respostas do gestor por competencia_nome + tipo
    const gestorMap = new Map<string, (typeof gestorRespostas)[0]>();
    gestorRespostas.forEach((r) => {
      const key = `${r.competencia_nome}|${r.tipo || "tecnica"}`;
      gestorMap.set(key, r);
    });

    // Criar mapa de respostas da autoavaliacao por competencia_nome + tipo
    const autoMap = new Map<string, (typeof autoRespostas)[0]>();
    autoRespostas.forEach((r) => {
      const key = `${r.competencia_nome}|${r.tipo || "tecnica"}`;
      autoMap.set(key, r);
    });

    const sanitizeNota = (raw: any): number | null => {
      const n = Number(raw);
      return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
    };

    const merged: IntegradaRespostaState[] = [];

    // 1) TÉCNICAS — vêm da matriz da unidade (fonte de verdade). Para cada
    //    técnica da matriz, busca a resposta em auto e gestor (pode faltar).
    //    Caso a matriz não esteja disponível (fallback), usa a união das fontes.
    //    NÃO deduplica por nome — autoavaliação e avaliação_gestor não deduplicam,
    //    então a integrada também não pode (caso contrário, técnicas duplicadas
    //    no catálogo da unidade somem aqui mas continuam visíveis nas fontes).
    if (tecnicasMatriz && tecnicasMatriz.length > 0) {
      // Para cada ocorrência da técnica na matriz, "consumimos" uma resposta
      // correspondente nas fontes. Isso garante 1-pra-1 mesmo com nomes repetidos.
      const consumedAuto = new Set<number>();
      const consumedGestor = new Set<number>();
      const findUnused = (
        list: typeof autoRespostas,
        consumed: Set<number>,
        nome: string,
      ) => {
        for (let i = 0; i < list.length; i++) {
          if (consumed.has(i)) continue;
          const r = list[i];
          if ((r.tipo || "tecnica") !== "tecnica") continue;
          if (r.competencia_nome !== nome) continue;
          consumed.add(i);
          return r;
        }
        return undefined;
      };
      tecnicasMatriz.forEach((t) => {
        const autoResp = findUnused(autoRespostas, consumedAuto, t.nome);
        const gestorResp = findUnused(gestorRespostas, consumedGestor, t.nome);
        merged.push({
          competencia_unidade_id:
            tipoInventario === "gestor" ? undefined : t.id,
          competencia_nome: t.nome,
          competencia_descricao: t.descricao || "",
          nota_autoavaliacao: sanitizeNota(autoResp?.nota),
          nota_gestor: sanitizeNota(gestorResp?.nota),
          nota_integrada: "",
          comentario: "",
          comentario_autoavaliacao: autoResp?.comentario || "",
          comentario_gestor: gestorResp?.comentario || "",
          tipo: "tecnica",
        });
      });
    } else {
      // Fallback: união das técnicas presentes nas duas fontes
      const tecnicasKeys = new Set<string>();
      autoRespostas.forEach((r) => {
        if ((r.tipo || "tecnica") === "tecnica")
          tecnicasKeys.add(`${r.competencia_nome}|tecnica`);
      });
      gestorRespostas.forEach((r) => {
        if ((r.tipo || "tecnica") === "tecnica")
          tecnicasKeys.add(`${r.competencia_nome}|tecnica`);
      });
      tecnicasKeys.forEach((key) => {
        const autoResp = autoMap.get(key);
        const gestorResp = gestorMap.get(key);
        const [nome] = key.split("|");
        merged.push({
          competencia_unidade_id:
            tipoInventario === "gestor"
              ? undefined
              : autoResp?.competencia_unidade_id ||
                gestorResp?.competencia_unidade_id,
          competencia_nome: nome,
          competencia_descricao:
            autoResp?.competencia_descricao ||
            gestorResp?.competencia_descricao ||
            "",
          nota_autoavaliacao: sanitizeNota(autoResp?.nota),
          nota_gestor: sanitizeNota(gestorResp?.nota),
          nota_integrada: "",
          comentario: "",
          comentario_autoavaliacao: autoResp?.comentario || "",
          comentario_gestor: gestorResp?.comentario || "",
          tipo: "tecnica",
        });
      });
    }

    // 2) COMPORTAMENTAIS / ESTRATÉGICAS / GERENCIAIS — união das fontes
    //    (vêm dos padrões correntes; cada fonte foi preenchida com os padrões
    //    do momento em que foi salva, então a união cobre o que existe).
    const padraoTipos: Array<"comportamental" | "estrategica" | "gerencial"> = [
      "comportamental",
      "estrategica",
      "gerencial",
    ];
    padraoTipos.forEach((tipo) => {
      const keys = new Set<string>();
      autoRespostas.forEach((r) => {
        if ((r.tipo || "tecnica") === tipo)
          keys.add(`${r.competencia_nome}|${tipo}`);
      });
      gestorRespostas.forEach((r) => {
        if ((r.tipo || "tecnica") === tipo)
          keys.add(`${r.competencia_nome}|${tipo}`);
      });
      keys.forEach((key) => {
        const autoResp = autoMap.get(key);
        const gestorResp = gestorMap.get(key);
        const [nome] = key.split("|");
        merged.push({
          competencia_unidade_id:
            tipoInventario === "gestor"
              ? undefined
              : autoResp?.competencia_unidade_id ||
                gestorResp?.competencia_unidade_id,
          competencia_nome: nome,
          competencia_descricao:
            autoResp?.competencia_descricao ||
            gestorResp?.competencia_descricao ||
            "",
          nota_autoavaliacao: sanitizeNota(autoResp?.nota),
          nota_gestor: sanitizeNota(gestorResp?.nota),
          nota_integrada: "",
          comentario: "",
          comentario_autoavaliacao: autoResp?.comentario || "",
          comentario_gestor: gestorResp?.comentario || "",
          tipo,
        });
      });
    });

    // (avoid unused var warning for pessoa parameter intent — preserved for symmetry)
    void pessoa;

    // Ordenar: tecnicas, comportamentais, estrategicas, gerenciais
    const tipoOrder: Record<string, number> = {
      tecnica: 0,
      comportamental: 1,
      estrategica: 2,
      gerencial: 3,
    };
    merged.sort(
      (a, b) => (tipoOrder[a.tipo] ?? 99) - (tipoOrder[b.tipo] ?? 99),
    );

    setForm((prev) => ({
      ...prev,
      autoavaliacao_id: pessoa.autoavaliacao_id,
      avaliacao_gestor_id: pessoa.avaliacao_gestor_id,
      respostas: merged,
    }));
  };

  // Carregar diretoria e unidades autorizadas
  useEffect(() => {
    const load = async () => {
      try {
        // Para Avaliação Integrada do Gestor (tipoInventario='gestor'), carregar unidades macroárea do domínio
        const fetchUnidades =
          tipoInventario === "gestor"
            ? competenciasGestorApi.getUnidadesLideranca()
            : competenciasGestorApi.getUnidadesAutorizadasInventario();

        const [allAreas, autorizadas] = await Promise.all([
          areasApi.getAll(),
          fetchUnidades,
        ]);

        if (allAreas.length > 0) {
          const userArea =
            allAreas.find((a) => a.sigla === user?.diretoria) ||
            allAreas.find((a) => a.is_domain_root === true) ||
            allAreas[0];
          setDiretoriaUsuario(userArea?.sigla || userArea?.nome || "");
          setAreaUsuarioId(userArea?.id || null);
        }

        setUnidadesAutorizadas(autorizadas);

        if (isEditMode && formularioEdit) {
          // Pré-popular a partir do formulário existente
          const autoavaliacao_id = (formularioEdit as any).autoavaliacao_id;
          const avaliacao_gestor_id = (formularioEdit as any)
            .avaliacao_gestor_id;
          const respostasV1 = formularioEdit.respostas || [];

          // Buscar dados ATUAIS de autoavaliação + avaliação_gestor (já podem ter sido re-validadas
          // com novas competências). Comparar com v1 (respostasV1) para travar inalteradas.
          let respostasFinais: IntegradaRespostaState[] = [];
          const changedSet = new Set<string>();

          if (autoavaliacao_id && avaliacao_gestor_id) {
            try {
              // Carregar parData (auto + gestor) e a matriz da unidade em paralelo.
              // A matriz é a fonte de verdade das técnicas — assim a integrada
              // sempre traz TODAS as técnicas cadastradas, mesmo as duplicadas.
              const unidadeIdEdit = formularioEdit.unidade_id
                ? Number(formularioEdit.unidade_id)
                : null;
              const [parData, tecnicasMatriz] = await Promise.all([
                avaliacaoIntegradaApi.getParData(
                  autoavaliacao_id,
                  avaliacao_gestor_id,
                ),
                unidadeIdEdit
                  ? (tipoInventario === "gestor"
                      ? competenciasGestorApi.getCompetenciasGestorPorUnidade(
                          unidadeIdEdit,
                        )
                      : competenciasGestorApi.getCompetenciasPorUnidade(
                          unidadeIdEdit,
                        )
                    ).catch(() => [] as CompetenciaPorUnidade[])
                  : Promise.resolve([] as CompetenciaPorUnidade[]),
              ]);
              if (parData?.autoavaliacao && parData?.avaliacaoGestor) {
                const autoR = parData.autoavaliacao.respostas || [];
                const gestorR = parData.avaliacaoGestor.respostas || [];

                const sanitizeNota = (raw: any): number | null => {
                  const n = Number(raw);
                  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
                };

                // Helper: pareamento 1‑pra‑1 que respeita ocorrências repetidas.
                // Cada resposta de auto/gestor/v1 só pode ser "consumida" uma vez.
                const consumedAuto = new Set<number>();
                const consumedGestor = new Set<number>();
                const consumedV1 = new Set<number>();
                const findUnused = (
                  list: any[],
                  consumed: Set<number>,
                  tipo: string,
                  nome: string,
                ) => {
                  for (let i = 0; i < list.length; i++) {
                    if (consumed.has(i)) continue;
                    const r = list[i];
                    if ((r.tipo || "tecnica") !== tipo) continue;
                    if (r.competencia_nome !== nome) continue;
                    consumed.add(i);
                    return r;
                  }
                  return undefined;
                };

                const pushItem = (
                  nome: string,
                  tipo:
                    | "tecnica"
                    | "comportamental"
                    | "estrategica"
                    | "gerencial",
                  a: any,
                  g: any,
                  descMatriz?: string,
                  idMatriz?: number,
                ) => {
                  const v1 = findUnused(respostasV1, consumedV1, tipo, nome);
                  const notaAuto = sanitizeNota(a?.nota);
                  const notaGestor = sanitizeNota(g?.nota);
                  const v1NotaAuto =
                    v1 && v1.nota_autoavaliacao != null
                      ? Number(v1.nota_autoavaliacao)
                      : null;
                  const v1NotaGestor =
                    v1 && v1.nota_gestor != null
                      ? Number(v1.nota_gestor)
                      : null;
                  const desc =
                    descMatriz ||
                    a?.competencia_descricao ||
                    g?.competencia_descricao ||
                    "";
                  const inalterado =
                    !!v1 &&
                    (v1.competencia_descricao || "") === desc &&
                    v1NotaAuto === notaAuto &&
                    v1NotaGestor === notaGestor;
                  const key = `${nome}|${tipo}`;
                  if (!inalterado) changedSet.add(key);
                  respostasFinais.push({
                    competencia_unidade_id:
                      tipoInventario === "gestor"
                        ? undefined
                        : (idMatriz ??
                          a?.competencia_unidade_id ??
                          g?.competencia_unidade_id),
                    competencia_nome: nome,
                    competencia_descricao: desc,
                    nota_autoavaliacao: notaAuto,
                    nota_gestor: notaGestor,
                    nota_integrada: inalterado
                      ? String(v1?.nota_integrada || "")
                      : "",
                    comentario: inalterado ? v1?.comentario || "" : "",
                    comentario_autoavaliacao: a?.comentario || "",
                    comentario_gestor: g?.comentario || "",
                    tipo,
                  });
                };

                // 1) TÉCNICAS — todas as ocorrências da matriz da unidade. Cada
                //    ocorrência puxa uma resposta auto/gestor que ainda não foi
                //    consumida (preserva duplicatas com mesmo nome).
                if (tecnicasMatriz && tecnicasMatriz.length > 0) {
                  tecnicasMatriz.forEach((t) => {
                    const a = findUnused(
                      autoR,
                      consumedAuto,
                      "tecnica",
                      t.nome,
                    );
                    const g = findUnused(
                      gestorR,
                      consumedGestor,
                      "tecnica",
                      t.nome,
                    );
                    pushItem(t.nome, "tecnica", a, g, t.descricao || "", t.id);
                  });
                } else {
                  // Fallback: união das técnicas presentes nas duas fontes.
                  const tecnicasSet = new Set<string>();
                  autoR.forEach((r) => {
                    if ((r.tipo || "tecnica") === "tecnica")
                      tecnicasSet.add(`${r.competencia_nome}|tecnica`);
                  });
                  gestorR.forEach((r) => {
                    if ((r.tipo || "tecnica") === "tecnica")
                      tecnicasSet.add(`${r.competencia_nome}|tecnica`);
                  });
                  tecnicasSet.forEach((key) => {
                    const [nome] = key.split("|");
                    const a = findUnused(autoR, consumedAuto, "tecnica", nome);
                    const g = findUnused(
                      gestorR,
                      consumedGestor,
                      "tecnica",
                      nome,
                    );
                    pushItem(nome, "tecnica", a, g);
                  });
                }

                // 2) COMPORTAMENTAIS / ESTRATÉGICAS / GERENCIAIS — união entre fontes.
                const padraoTipos: Array<
                  "comportamental" | "estrategica" | "gerencial"
                > = ["comportamental", "estrategica", "gerencial"];
                padraoTipos.forEach((tipo) => {
                  const keys = new Set<string>();
                  autoR.forEach((r) => {
                    if ((r.tipo || "tecnica") === tipo)
                      keys.add(`${r.competencia_nome}|${tipo}`);
                  });
                  gestorR.forEach((r) => {
                    if ((r.tipo || "tecnica") === tipo)
                      keys.add(`${r.competencia_nome}|${tipo}`);
                  });
                  keys.forEach((key) => {
                    const [nome] = key.split("|");
                    const a = findUnused(autoR, consumedAuto, tipo, nome);
                    const g = findUnused(gestorR, consumedGestor, tipo, nome);
                    pushItem(nome, tipo, a, g);
                  });
                });
              }
            } catch (errPar) {
              /* erro já tratado pelo apiClient ou ignorado intencionalmente */
            }
          }

          // Fallback: se não conseguiu buscar parData, usar respostas v1 puras
          if (respostasFinais.length === 0) {
            respostasFinais = respostasV1.map((r: any) => ({
              competencia_unidade_id: r.competencia_unidade_id || undefined,
              competencia_nome: r.competencia_nome,
              competencia_descricao: r.competencia_descricao || "",
              nota_autoavaliacao:
                r.nota_autoavaliacao != null
                  ? Number(r.nota_autoavaliacao)
                  : null,
              nota_gestor: r.nota_gestor != null ? Number(r.nota_gestor) : null,
              nota_integrada: String(r.nota_integrada || ""),
              comentario: r.comentario || "",
              comentario_autoavaliacao: r.comentario_autoavaliacao || "",
              comentario_gestor: r.comentario_gestor || "",
              tipo: (r.tipo || "tecnica") as
                | "tecnica"
                | "comportamental"
                | "estrategica"
                | "gerencial",
            }));
          }

          // Ordenar: tecnicas, comportamentais, estrategicas, gerenciais
          const tipoOrder: Record<string, number> = {
            tecnica: 0,
            comportamental: 1,
            estrategica: 2,
            gerencial: 3,
          };
          respostasFinais.sort(
            (a, b) => (tipoOrder[a.tipo] ?? 99) - (tipoOrder[b.tipo] ?? 99),
          );

          setChangedKeys(changedSet);
          setForm({
            unidade_id: formularioEdit.unidade_id
              ? String(formularioEdit.unidade_id)
              : "",
            unidade_path: formularioEdit.unidade_id
              ? [String(formularioEdit.unidade_id)]
              : [],
            pessoa_id: String(formularioEdit.pessoa_id),
            pessoa_nome: formularioEdit.pessoa_nome,
            autoavaliacao_id,
            avaliacao_gestor_id,
            respostas: respostasFinais,
          });
        } else if (autorizadas.length === 1) {
          const u = autorizadas[0];
          setForm((prev) => ({
            ...prev,
            unidade_id: String(u.id),
            unidade_path: [String(u.id)],
          }));
          loadElegiveis(u.id);
        }
      } catch (err) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      } finally {
        setLoadingUnidades(false);
      }
    };
    load();
  }, []);

  // Handlers
  const updateResposta = (
    index: number,
    field: "nota_integrada" | "comentario",
    value: string,
  ) => {
    setForm((prev) => {
      const respostas = [...prev.respostas];
      respostas[index] = { ...respostas[index], [field]: value };
      return { ...prev, respostas };
    });
  };

  const handleSubmit = async () => {
    // Validacao
    if (!form.unidade_id) return toast.error("Selecione a unidade.");
    if (!form.pessoa_id) return toast.error("Selecione o colaborador.");
    if (!form.autoavaliacao_id || !form.avaliacao_gestor_id) {
      return toast.error("Dados das avaliações não encontrados.");
    }

    if (form.respostas.length === 0) {
      return toast.error("Nenhuma competência encontrada para avaliar.");
    }

    for (let i = 0; i < form.respostas.length; i++) {
      const r = form.respostas[i];
      // Em modo edição, itens travados (inalterados) preservam dados v1 — não validam.
      if (isEditMode && !isItemChanged(r.competencia_nome, r.tipo)) continue;
      if (!r.nota_integrada) {
        return toast.error(
          `Selecione a nota integrada para a competência "${r.competencia_nome}".`,
        );
      }
      if (!r.comentario.trim()) {
        return toast.error(
          `Preencha o comentário para a competência "${r.competencia_nome}".`,
        );
      }
    }

    setSaving(true);
    try {
      const respostas = form.respostas.map((r) => ({
        competencia_unidade_id:
          tipoInventario === "gestor" ? undefined : r.competencia_unidade_id,
        competencia_nome: r.competencia_nome,
        competencia_descricao: r.competencia_descricao || undefined,
        nota_autoavaliacao: r.nota_autoavaliacao,
        nota_gestor: r.nota_gestor,
        nota_integrada: Number(r.nota_integrada),
        comentario: r.comentario.trim() || undefined,
        tipo: r.tipo,
      }));

      const payload = {
        autoavaliacao_id: form.autoavaliacao_id!,
        avaliacao_gestor_id: form.avaliacao_gestor_id!,
        pessoa_id: Number(form.pessoa_id),
        pessoa_nome: form.pessoa_nome.trim(),
        avaliador_nome: user?.name || "",
        cadastros_areas_id: areaUsuarioId || undefined,
        diretoria: diretoriaUsuario,
        unidade_id: form.unidade_id ? Number(form.unidade_id) : undefined,
        tipo_inventario: tipoInventario || "equipe",
        respostas,
      };

      const result = await avaliacaoIntegradaApi.create(payload);

      if (onSubmitted && result) onSubmitted(result);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  };

  // Mapa: tipo -> array de { resposta, globalIndex } onde globalIndex é o
  // índice REAL da resposta em form.respostas. Usar findIndex direto no JSX
  // falhava com nomes duplicados (sempre apontava pra primeira ocorrência —
  // bloqueando a interação com as demais). Aqui cada item tem seu índice próprio.
  const respostasComIndice = form.respostas.map((resposta, globalIndex) => ({
    resposta,
    globalIndex,
  }));
  const respostasTecnicas = respostasComIndice.filter(
    (x) => x.resposta.tipo === "tecnica",
  );
  const respostasComportamentais = respostasComIndice.filter(
    (x) => x.resposta.tipo === "comportamental",
  );
  const respostasEstrategicas = respostasComIndice.filter(
    (x) => x.resposta.tipo === "estrategica",
  );
  const respostasGerenciais = respostasComIndice.filter(
    (x) => x.resposta.tipo === "gerencial",
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Texto Introdutorio */}
      <div className="rounded-xl bg-teal-50 border border-teal-200 p-8">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Info className="h-5 w-5 text-teal-600" />
          </div>
          <div className="text-base text-gray-700 space-y-4">
            <p>
              <strong className="text-gray-900">Avaliação Integrada:</strong>{" "}
              Nesta etapa, são analisadas conjuntamente a autoavaliação do
              colaborador e a avaliação do gestor, permitindo a definição
              consensual da nota final de cada competência.
            </p>
            <p>
              Este momento é destinado ao alinhamento de percepções e à troca de
              feedback entre gestor e colaborador, contribuindo para uma
              avaliação mais transparente e aderente ao desempenho apresentado.
            </p>
            <p className="font-semibold text-gray-900">Orientações:</p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Selecione a unidade e o colaborador elegível.</li>
              <li>
                Compare as notas da autoavaliação e da avaliação do gestor.
              </li>
              <li>
                Defina a nota de consenso (avaliação integrada) para cada
                competência.
              </li>
              <li>
                Utilize o campo de comentários para registrar observações
                relevantes sobre o consenso definido, quando aplicável.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Secao - Diretoria (automatica) */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Diretoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            <span className="text-sm text-gray-500">
              Identificação da Diretoria
            </span>
            <p className="font-medium text-gray-800 mt-0.5">
              {diretoriaUsuario || "Carregando..."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Secao - Unidade */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Unidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>
              Identificação da Unidade <span className="text-red-500">*</span>
            </Label>
            {isEditMode ? (
              <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                <p className="font-medium text-gray-800">
                  {formularioEdit?.unidade_nome || "-"}
                </p>
              </div>
            ) : loadingUnidades ? (
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando unidades...
              </div>
            ) : unidadesAutorizadas.length === 0 ? (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700">
                  Nenhuma unidade autorizada encontrada para seu usuário.
                  Verifique com o administrador.
                </p>
              </div>
            ) : unidadesAutorizadas.length === 1 ? (
              <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                <p className="font-medium text-gray-800">
                  {unidadesAutorizadas[0].nome}
                </p>
              </div>
            ) : (
              <>
                <Select
                  value={form.unidade_id}
                  onValueChange={handleUnidadeSelect}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {unidadesAutorizadas.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Secao - Selecao do Colaborador */}
      {form.unidade_id && (
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Colaborador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>
              Selecione o colaborador{" "}
              {!isEditMode && <span className="text-red-500">*</span>}
            </Label>
            {isEditMode ? (
              <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                <p className="font-medium text-gray-800">{form.pessoa_nome}</p>
              </div>
            ) : loadingElegiveis ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando colaboradores elegíveis...
              </div>
            ) : elegiveis.length === 0 ? (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700">
                  Nenhum colaborador elegível para avaliação integrada nesta
                  unidade. Ambas as avaliações (autoavaliação e avaliação do
                  gestor) precisam estar preenchidas.
                </p>
              </div>
            ) : (
              <Select value={form.pessoa_id} onValueChange={handlePessoaSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {elegiveis.map((p) => (
                    <SelectItem key={p.pessoa_id} value={String(p.pessoa_id)}>
                      {p.pessoa_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Carregando dados comparativos */}
      {loadingParData && (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando dados comparativos das avaliações...
        </div>
      )}

      {/* Secao - Competencias Tecnicas */}
      {form.pessoa_id && !loadingParData && respostasTecnicas.length > 0 && (
        <>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info className="h-5 w-5 text-amber-600" />
              </div>
              <div className="text-base text-gray-700 space-y-4">
                <p className="font-semibold text-gray-900 text-lg">
                  Competências Técnicas
                </p>
                <p>
                  Compare as notas da autoavaliação e da avaliação do gestor
                  para definir a nota de consenso de cada competência.
                </p>
                <p className="font-semibold text-gray-900">
                  Escala de Avaliação:
                </p>
                <EscalaLegenda items={ESCALA_NOTAS} />
              </div>
            </div>
          </div>

          {respostasTecnicas.map(({ resposta, globalIndex }, index) => {
            const isChanged = isItemChanged(
              resposta.competencia_nome,
              resposta.tipo,
            );
            const isLocked = isEditMode && !isChanged;

            return (
              <Card
                key={`tec-${index}`}
                className="border border-gray-200 shadow-sm"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-teal-600 font-bold mr-2">
                      {index + 1}.
                    </span>
                    <span className="flex-1">{resposta.competencia_nome}</span>
                    {isEditMode && isChanged && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                        Alterada
                      </span>
                    )}
                    {isLocked && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">
                        Travada
                      </span>
                    )}
                  </CardTitle>
                  {resposta.competencia_descricao && (
                    <p className="text-sm text-gray-500 mt-1 [overflow-wrap:anywhere]">
                      {resposta.competencia_descricao}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Notas comparativas */}
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          Autoavaliação do Colaborador:
                        </span>
                        {renderNotaBadge(
                          resposta.nota_autoavaliacao,
                          NOTA_TECNICA_LABELS,
                        )}
                      </div>
                      {resposta.comentario_autoavaliacao && (
                        <p className="text-xs text-gray-500 italic ml-1 [overflow-wrap:anywhere]">
                          "{resposta.comentario_autoavaliacao}"
                        </p>
                      )}
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          Avaliação do Gestor:
                        </span>
                        {renderNotaBadge(
                          resposta.nota_gestor,
                          NOTA_TECNICA_LABELS,
                        )}
                      </div>
                      {resposta.comentario_gestor && (
                        <p className="text-xs text-gray-500 italic ml-1 [overflow-wrap:anywhere]">
                          "{resposta.comentario_gestor}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Nota integrada */}
                  <fieldset
                    disabled={isLocked}
                    className={isLocked ? "opacity-70" : ""}
                  >
                    <div>
                      <Label>
                        Avaliação Integrada (consenso){" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <EscalaRadioGroup
                        items={ESCALA_NOTAS}
                        name={`nota-integrada-tec-${index}`}
                        value={resposta.nota_integrada}
                        onChange={(v) =>
                          updateResposta(globalIndex, "nota_integrada", v)
                        }
                        accentColor="teal"
                      />
                    </div>

                    {/* Comentário */}
                    <div>
                      <Label>
                        Comentário <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        value={resposta.comentario}
                        onChange={(e) =>
                          updateResposta(
                            globalIndex,
                            "comentario",
                            e.target.value,
                          )
                        }
                        placeholder="Observações sobre o consenso"
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                  </fieldset>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {/* Secao - Competencias Comportamentais */}
      {form.pessoa_id &&
        !loadingParData &&
        respostasComportamentais.length > 0 && (
          <>
            <div className="rounded-xl bg-violet-50 border border-violet-200 p-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Info className="h-5 w-5 text-violet-600" />
                </div>
                <div className="text-base text-gray-700 space-y-4">
                  <p className="font-semibold text-gray-900 text-lg">
                    Competências Comportamentais
                  </p>
                  <p>
                    Compare as notas da autoavaliação e da avaliação do gestor
                    para definir a nota de consenso de cada competência.
                  </p>
                  <p className="font-semibold text-gray-900">
                    Escala de Avaliação:
                  </p>
                  <EscalaLegenda items={ESCALA_COMPORTAMENTAL} />
                </div>
              </div>
            </div>

            {respostasComportamentais.map(
              ({ resposta, globalIndex }, index) => {
                const isChanged = isItemChanged(
                  resposta.competencia_nome,
                  resposta.tipo,
                );
                const isLocked = isEditMode && !isChanged;

                return (
                  <Card
                    key={`comp-${index}`}
                    className="border border-gray-200 shadow-sm"
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-violet-600 font-bold mr-2">
                          {index + 1}.
                        </span>
                        <span className="flex-1">
                          {resposta.competencia_nome}
                        </span>
                        {isEditMode && isChanged && (
                          <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                            Alterada
                          </span>
                        )}
                        {isLocked && (
                          <span className="text-xs font-medium px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">
                            Travada
                          </span>
                        )}
                      </CardTitle>
                      {resposta.competencia_descricao && (
                        <p className="text-sm text-gray-500 mt-1 [overflow-wrap:anywhere]">
                          {resposta.competencia_descricao}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Notas comparativas */}
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              Autoavaliação do Colaborador:
                            </span>
                            {renderNotaBadge(
                              resposta.nota_autoavaliacao,
                              NOTA_COMPORTAMENTAL_LABELS,
                            )}
                          </div>
                          {resposta.comentario_autoavaliacao && (
                            <p className="text-xs text-gray-500 italic ml-1 [overflow-wrap:anywhere]">
                              "{resposta.comentario_autoavaliacao}"
                            </p>
                          )}
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              Avaliação do Gestor:
                            </span>
                            {renderNotaBadge(
                              resposta.nota_gestor,
                              NOTA_COMPORTAMENTAL_LABELS,
                            )}
                          </div>
                          {resposta.comentario_gestor && (
                            <p className="text-xs text-gray-500 italic ml-1 [overflow-wrap:anywhere]">
                              "{resposta.comentario_gestor}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Nota integrada */}
                      <fieldset
                        disabled={isLocked}
                        className={isLocked ? "opacity-70" : ""}
                      >
                        <div>
                          <Label>
                            Avaliação Integrada (consenso){" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          <EscalaRadioGroup
                            items={ESCALA_COMPORTAMENTAL}
                            name={`nota-integrada-comp-${index}`}
                            value={resposta.nota_integrada}
                            onChange={(v) =>
                              updateResposta(globalIndex, "nota_integrada", v)
                            }
                            accentColor="violet"
                          />
                        </div>

                        {/* Comentário */}
                        <div>
                          <Label>
                            Comentário <span className="text-red-500">*</span>
                          </Label>
                          <Textarea
                            value={resposta.comentario}
                            onChange={(e) =>
                              updateResposta(
                                globalIndex,
                                "comentario",
                                e.target.value,
                              )
                            }
                            placeholder="Observações sobre o consenso"
                            className="mt-1"
                            rows={3}
                          />
                        </div>
                      </fieldset>
                    </CardContent>
                  </Card>
                );
              },
            )}
          </>
        )}

      {/* Secao - Competencias Estrategicas (apenas gestor) */}
      {form.pessoa_id &&
        !loadingParData &&
        respostasEstrategicas.length > 0 && (
          <>
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Info className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-base text-gray-700 space-y-4">
                  <p className="font-semibold text-gray-900 text-lg">
                    Competências Estratégicas
                  </p>
                  <p>
                    Compare as notas da autoavaliação e da avaliação do gestor
                    para definir a nota de consenso de cada competência.
                  </p>
                  <p className="font-semibold text-gray-900">
                    Escala de Avaliação:
                  </p>
                  <EscalaLegenda items={ESCALA_ESTRATEGICA} />
                </div>
              </div>
            </div>

            {respostasEstrategicas.map(({ resposta, globalIndex }, index) => {
              const isChanged = isItemChanged(
                resposta.competencia_nome,
                resposta.tipo,
              );
              const isLocked = isEditMode && !isChanged;

              return (
                <Card
                  key={`estr-${index}`}
                  className="border border-gray-200 shadow-sm"
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-blue-600 font-bold mr-2">
                        {index + 1}.
                      </span>
                      <span className="flex-1">
                        {resposta.competencia_nome}
                      </span>
                      {isEditMode && isChanged && (
                        <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                          Alterada
                        </span>
                      )}
                      {isLocked && (
                        <span className="text-xs font-medium px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">
                          Travada
                        </span>
                      )}
                    </CardTitle>
                    {resposta.competencia_descricao && (
                      <p className="text-sm text-gray-500 mt-1 [overflow-wrap:anywhere]">
                        {resposta.competencia_descricao}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            Autoavaliação:
                          </span>
                          {renderNotaBadge(
                            resposta.nota_autoavaliacao,
                            NOTA_ESTRATEGICA_LABELS,
                          )}
                        </div>
                        {resposta.comentario_autoavaliacao && (
                          <p className="text-xs text-gray-500 italic ml-1 [overflow-wrap:anywhere]">
                            "{resposta.comentario_autoavaliacao}"
                          </p>
                        )}
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            Avaliação da Liderança:
                          </span>
                          {renderNotaBadge(
                            resposta.nota_gestor,
                            NOTA_ESTRATEGICA_LABELS,
                          )}
                        </div>
                        {resposta.comentario_gestor && (
                          <p className="text-xs text-gray-500 italic ml-1 [overflow-wrap:anywhere]">
                            "{resposta.comentario_gestor}"
                          </p>
                        )}
                      </div>
                    </div>

                    <fieldset
                      disabled={isLocked}
                      className={isLocked ? "opacity-70" : ""}
                    >
                      <div>
                        <Label>
                          Avaliação Integrada (consenso){" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <EscalaRadioGroup
                          items={ESCALA_ESTRATEGICA}
                          name={`nota-integrada-estr-${index}`}
                          value={resposta.nota_integrada}
                          onChange={(v) =>
                            updateResposta(globalIndex, "nota_integrada", v)
                          }
                          accentColor="blue"
                        />
                      </div>

                      <div>
                        <Label>
                          Comentário <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          value={resposta.comentario}
                          onChange={(e) =>
                            updateResposta(
                              globalIndex,
                              "comentario",
                              e.target.value,
                            )
                          }
                          placeholder="Observações sobre o consenso"
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                    </fieldset>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}

      {/* Secao - Competencias Gerenciais (apenas gestor) */}
      {form.pessoa_id && !loadingParData && respostasGerenciais.length > 0 && (
        <>
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info className="h-5 w-5 text-rose-600" />
              </div>
              <div className="text-base text-gray-700 space-y-4">
                <p className="font-semibold text-gray-900 text-lg">
                  Competências Gerenciais
                </p>
                <p>
                  Compare as notas da autoavaliação e da avaliação do gestor
                  para definir a nota de consenso de cada competência.
                </p>
                <p className="font-semibold text-gray-900">
                  Escala de Avaliação:
                </p>
                <EscalaLegenda items={ESCALA_GERENCIAL} />
              </div>
            </div>
          </div>

          {respostasGerenciais.map(({ resposta, globalIndex }, index) => {
            const isChanged = isItemChanged(
              resposta.competencia_nome,
              resposta.tipo,
            );
            const isLocked = isEditMode && !isChanged;

            return (
              <Card
                key={`ger-${index}`}
                className="border border-gray-200 shadow-sm"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-rose-600 font-bold mr-2">
                      {index + 1}.
                    </span>
                    <span className="flex-1">{resposta.competencia_nome}</span>
                    {isEditMode && isChanged && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                        Alterada
                      </span>
                    )}
                    {isLocked && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">
                        Travada
                      </span>
                    )}
                  </CardTitle>
                  {resposta.competencia_descricao && (
                    <p className="text-sm text-gray-500 mt-1 [overflow-wrap:anywhere]">
                      {resposta.competencia_descricao}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          Autoavaliação:
                        </span>
                        {renderNotaBadge(
                          resposta.nota_autoavaliacao,
                          NOTA_GERENCIAL_LABELS,
                        )}
                      </div>
                      {resposta.comentario_autoavaliacao && (
                        <p className="text-xs text-gray-500 italic ml-1 [overflow-wrap:anywhere]">
                          "{resposta.comentario_autoavaliacao}"
                        </p>
                      )}
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          Avaliação da Liderança:
                        </span>
                        {renderNotaBadge(
                          resposta.nota_gestor,
                          NOTA_GERENCIAL_LABELS,
                        )}
                      </div>
                      {resposta.comentario_gestor && (
                        <p className="text-xs text-gray-500 italic ml-1 [overflow-wrap:anywhere]">
                          "{resposta.comentario_gestor}"
                        </p>
                      )}
                    </div>
                  </div>

                  <fieldset
                    disabled={isLocked}
                    className={isLocked ? "opacity-70" : ""}
                  >
                    <div>
                      <Label>
                        Avaliação Integrada (consenso){" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <EscalaRadioGroup
                        items={ESCALA_GERENCIAL}
                        name={`nota-integrada-ger-${index}`}
                        value={resposta.nota_integrada}
                        onChange={(v) =>
                          updateResposta(globalIndex, "nota_integrada", v)
                        }
                        accentColor="rose"
                      />
                    </div>

                    <div>
                      <Label>
                        Comentário <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        value={resposta.comentario}
                        onChange={(e) =>
                          updateResposta(
                            globalIndex,
                            "comentario",
                            e.target.value,
                          )
                        }
                        placeholder="Observações sobre o consenso"
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                  </fieldset>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {/* Botao Enviar */}
      {form.respostas.length > 0 && !loadingParData && (
        <div className="flex justify-end pb-6">
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 text-base"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar avaliação integrada
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
