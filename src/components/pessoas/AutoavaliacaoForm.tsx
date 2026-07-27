import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { areasApi } from "@/services/areasApi";
import {
  competenciasGestorApi,
  CompetenciaPorUnidade,
  UnidadeAutorizada,
} from "@/services/competenciasGestorApi";
import {
  autoavaliacaoApi,
  AutoavaliacaoFormulario,
} from "@/services/autoavaliacaoApi";
// pessoasApi removido - nome agora é digitado pelo usuário
import {
  ESCALA_NOTAS,
  ESCALA_COMPORTAMENTAL,
  ESCALA_ESTRATEGICA,
  ESCALA_GERENCIAL,
  COMPETENCIAS_COMPORTAMENTAIS,
  COMPETENCIAS_ESTRATEGICAS,
  COMPETENCIAS_GERENCIAIS,
} from "@/constants/competencias";
import { EscalaLegenda, EscalaRadioGroup } from "./EscalaUI";
import { competenciasPadraoApi } from "@/services/competenciasPadraoApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface RespostaState {
  competencia_unidade_id: number;
  competencia_nome: string;
  competencia_descricao: string;
  nota: string;
  comentario: string;
}

interface RespostaComportamentalState {
  competencia_nome: string;
  competencia_descricao: string;
  nota: string;
  comentario: string;
}

interface FormState {
  nome_completo: string;
  matricula: string;
  cargo_funcao: string;
  email_institucional: string;
  pessoa_id: string;
  unidade_id: string;
  unidade_path: string[];
  respostas: RespostaState[];
  respostas_comportamentais: RespostaComportamentalState[];
  respostas_estrategicas: RespostaComportamentalState[];
  respostas_gerenciais: RespostaComportamentalState[];
}

interface AutoavaliacaoFormProps {
  tipoInventario?: "equipe" | "gestor";
  onSubmitted?: (formulario: AutoavaliacaoFormulario) => void;
  onViewResposta?: (formulario: AutoavaliacaoFormulario) => void;
  editMode?: boolean;
}

export function AutoavaliacaoForm({
  onSubmitted,
  onViewResposta,
  tipoInventario,
  editMode,
}: AutoavaliacaoFormProps) {
  const { user } = useAuth();

  const [unidadesAutorizadas, setUnidadesAutorizadas] = useState<
    UnidadeAutorizada[]
  >([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diretoriaUsuario, setDiretoriaUsuario] = useState<string>("");
  const [jaPreenchido, setJaPreenchido] =
    useState<AutoavaliacaoFormulario | null>(null);
  const [forceEditMode, setForceEditMode] = useState(false);
  const [savedVersaoAnterior, setSavedVersaoAnterior] = useState<number | null>(
    null,
  );
  // Chaves (nome||descricao) de competências padrão adicionadas/alteradas — só essas ficam editáveis
  const [changedCompKeys, setChangedCompKeys] = useState<Set<string>>(
    new Set(),
  );
  // Chaves (nome||descricao) de competências técnicas adicionadas/alteradas no referencial
  const [changedTecnicasKeys, setChangedTecnicasKeys] = useState<Set<string>>(
    new Set(),
  );

  const [competenciasUnidade, setCompetenciasUnidade] = useState<
    CompetenciaPorUnidade[]
  >([]);
  const [loadingCompetencias, setLoadingCompetencias] = useState(false);

  // Competências padrão carregadas da API (com fallback para constantes)
  const [compComportamentais, setCompComportamentais] = useState(
    COMPETENCIAS_COMPORTAMENTAIS,
  );
  const [compEstrategicas, setCompEstrategicas] = useState(
    COMPETENCIAS_ESTRATEGICAS,
  );
  const [compGerenciais, setCompGerenciais] = useState(COMPETENCIAS_GERENCIAIS);
  const [compVersao, setCompVersao] = useState<number | null>(null);

  useEffect(() => {
    competenciasPadraoApi
      .getAll()
      .then((data) => {
        if (data.comportamental?.length)
          setCompComportamentais(
            data.comportamental.map((c) => ({
              nome: c.nome,
              descricao: c.descricao,
            })),
          );
        if (data.estrategica?.length)
          setCompEstrategicas(
            data.estrategica.map((c) => ({
              nome: c.nome,
              descricao: c.descricao,
            })),
          );
        if (data.gerencial?.length)
          setCompGerenciais(
            data.gerencial.map((c) => ({
              nome: c.nome,
              descricao: c.descricao,
            })),
          );
        competenciasPadraoApi
          .getVersaoAtual()
          .then((v) => setCompVersao(v.versao))
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  // Quando os padrões chegam da API depois do mount, reconstrói os blocos de
  // respostas_* preservando notas/comentários já preenchidos. Sem isso, o form
  // ficaria travado nos padrões hardcoded das constantes (v1) em vez dos padrões
  // correntes publicados.
  useEffect(() => {
    if (editMode || forceEditMode) return; // edit mode é tratado em outro effect
    setForm((prev) => {
      const merge = (
        lista: { nome: string; descricao: string }[],
        atuais: typeof prev.respostas_comportamentais,
      ) =>
        lista.map((c) => {
          const ex = atuais.find((r) => r.competencia_nome === c.nome);
          return {
            competencia_nome: c.nome,
            competencia_descricao: c.descricao,
            nota: ex?.nota || "",
            comentario: ex?.comentario || "",
          };
        });
      return {
        ...prev,
        respostas_comportamentais: merge(
          compComportamentais,
          prev.respostas_comportamentais,
        ),
        respostas_estrategicas: merge(
          compEstrategicas,
          prev.respostas_estrategicas,
        ),
        respostas_gerenciais: merge(compGerenciais, prev.respostas_gerenciais),
      };
    });
  }, [
    compComportamentais,
    compEstrategicas,
    compGerenciais,
    editMode,
    forceEditMode,
  ]);

  const [form, setForm] = useState<FormState>({
    nome_completo: user?.name || "",
    matricula: "",
    cargo_funcao: "",
    email_institucional: user?.email || "",
    pessoa_id: "",
    unidade_id: "",
    unidade_path: [],
    respostas: [],
    respostas_comportamentais: compComportamentais.map((c) => ({
      competencia_nome: c.nome,
      competencia_descricao: c.descricao,
      nota: "",
      comentario: "",
    })),
    respostas_estrategicas: compEstrategicas.map((c) => ({
      competencia_nome: c.nome,
      competencia_descricao: c.descricao,
      nota: "",
      comentario: "",
    })),
    respostas_gerenciais: compGerenciais.map((c) => ({
      competencia_nome: c.nome,
      competencia_descricao: c.descricao,
      nota: "",
      comentario: "",
    })),
  });

  // Handler para seleção de unidade
  const handleUnidadeSelect = (value: string) => {
    setForm((prev) => ({
      ...prev,
      unidade_id: value,
      unidade_path: [value],
      pessoa_id: "",
      respostas: [],
    }));
    loadCompetencias(Number(value));
  };

  // Carrega competências mantendo as notas existentes (para edição)
  // Usa rastreio de índices consumidos para lidar com técnicas de nome duplicado
  const loadCompetenciasEdit = async (
    unidadeId: number,
    respostasExistentes: any[],
    skipChangeDetection = false,
  ) => {
    setLoadingCompetencias(true);
    try {
      const competencias =
        tipoInventario === "gestor"
          ? await competenciasGestorApi.getCompetenciasGestorPorUnidade(
              unidadeId,
            )
          : await competenciasGestorApi.getCompetenciasPorUnidade(unidadeId);
      setCompetenciasUnidade(competencias);

      const changedTec = new Set<string>();
      const usedIdx = new Set<number>();
      const isTecResp = (r: any) => r.tipo === "tecnica" || !r.tipo;

      const novasRespostas = competencias.map((c) => {
        // 1) Match exato: mesmo nome + mesma descrição, não consumido ainda → não mudou
        const exactIdx = respostasExistentes.findIndex(
          (r: any, i: number) =>
            !usedIdx.has(i) &&
            isTecResp(r) &&
            r.competencia_nome === c.nome &&
            (r.competencia_descricao || "") === (c.descricao || ""),
        );
        if (exactIdx !== -1) {
          usedIdx.add(exactIdx);
          const ex = respostasExistentes[exactIdx];
          return {
            competencia_unidade_id: c.id,
            competencia_nome: c.nome,
            competencia_descricao: c.descricao,
            nota: String(ex.nota || ""),
            comentario: ex.comentario || "",
          };
        }
        // 2) Match por nome (descrição mudou): preservar nota, marcar como alterada
        const nameIdx = respostasExistentes.findIndex(
          (r: any, i: number) =>
            !usedIdx.has(i) && isTecResp(r) && r.competencia_nome === c.nome,
        );
        if (nameIdx !== -1) {
          usedIdx.add(nameIdx);
          const ex = respostasExistentes[nameIdx];
          changedTec.add(`${c.nome}||${c.descricao || ""}`);
          return {
            competencia_unidade_id: c.id,
            competencia_nome: c.nome,
            competencia_descricao: c.descricao,
            nota: String(ex.nota || ""),
            comentario: ex.comentario || "",
          };
        }
        // 3) Match por posição (competência renomeada): preservar nota, marcar como alterada
        const posIdx = respostasExistentes.findIndex(
          (r: any, i: number) => !usedIdx.has(i) && isTecResp(r),
        );
        if (posIdx !== -1) {
          usedIdx.add(posIdx);
          const ex = respostasExistentes[posIdx];
          changedTec.add(`${c.nome}||${c.descricao || ""}`);
          return {
            competencia_unidade_id: c.id,
            competencia_nome: c.nome,
            competencia_descricao: c.descricao,
            nota: String(ex.nota || ""),
            comentario: ex.comentario || "",
          };
        }
        // 4) Competência genuinamente nova (adicionada) → editável
        changedTec.add(`${c.nome}||${c.descricao || ""}`);
        return {
          competencia_unidade_id: c.id,
          competencia_nome: c.nome,
          competencia_descricao: c.descricao,
          nota: "",
          comentario: "",
        };
      });

      if (!skipChangeDetection) setChangedTecnicasKeys(changedTec);
      setForm((prev) => ({ ...prev, respostas: novasRespostas }));
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingCompetencias(false);
    }
  };

  // Carregar competências da unidade selecionada
  // Para tipo gestor: o backend automaticamente busca da macroárea se a unidade não tem referencial próprio
  const loadCompetencias = async (unidadeId: number) => {
    setLoadingCompetencias(true);
    try {
      const competencias =
        tipoInventario === "gestor"
          ? await competenciasGestorApi.getCompetenciasGestorPorUnidade(
              unidadeId,
            )
          : await competenciasGestorApi.getCompetenciasPorUnidade(unidadeId);
      setCompetenciasUnidade(competencias);
      // Criar respostas iniciais para cada competência
      setForm((prev) => ({
        ...prev,
        respostas: competencias.map((c) => ({
          competencia_unidade_id: c.id,
          competencia_nome: c.nome,
          competencia_descricao: c.descricao,
          nota: "",
          comentario: "",
        })),
      }));
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingCompetencias(false);
    }
  };

  // Carregar diretoria e unidades autorizadas
  useEffect(() => {
    const load = async () => {
      try {
        // Verificar se usuário já preencheu autoavaliação para este tipo
        let formularioExistente: AutoavaliacaoFormulario | null = null;
        try {
          formularioExistente = await autoavaliacaoApi.getMeu(
            tipoInventario || "equipe",
          );
          if (formularioExistente && !editMode && !forceEditMode) {
            setJaPreenchido(formularioExistente);
            setLoadingUnidades(false);
            return;
          }
        } catch {
          /* erro já tratado pelo apiClient ou ignorado intencionalmente */
        }

        // Para autoavaliação tipo gestor: mostrar apenas a unidade onde o user é gestor (travada)
        // Para autoavaliação tipo equipe: mostrar unidades do colaborador
        const fetchUnidades =
          tipoInventario === "gestor"
            ? competenciasGestorApi.getMinhaUnidadeGestor()
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
        }

        setUnidadesAutorizadas(autorizadas);

        // Em editMode: carregar dados do formulário existente no form
        if ((editMode || forceEditMode) && formularioExistente) {
          const fullForm = await autoavaliacaoApi.getById(
            formularioExistente.id,
          );
          if (fullForm) {
            // Buscar competências padrão atuais diretamente (evita race condition com o useState)
            let padraoComp = compComportamentais;
            let padraoEstr = compEstrategicas;
            let padraoGer = compGerenciais;
            try {
              const padrao = await competenciasPadraoApi.getAll();
              if (padrao.comportamental?.length)
                padraoComp = padrao.comportamental.map((c) => ({
                  nome: c.nome,
                  descricao: c.descricao,
                }));
              if (padrao.estrategica?.length)
                padraoEstr = padrao.estrategica.map((c) => ({
                  nome: c.nome,
                  descricao: c.descricao,
                }));
              if (padrao.gerencial?.length)
                padraoGer = padrao.gerencial.map((c) => ({
                  nome: c.nome,
                  descricao: c.descricao,
                }));
              setCompComportamentais(padraoComp);
              setCompEstrategicas(padraoEstr);
              setCompGerenciais(padraoGer);
            } catch {
              /* erro já tratado pelo apiClient ou ignorado intencionalmente */
            }

            setForm((prev) => ({
              ...prev,
              nome_completo: fullForm.nome_completo || prev.nome_completo,
              matricula: fullForm.matricula || "",
              cargo_funcao: fullForm.cargo_funcao || "",
              email_institucional:
                fullForm.email_institucional || prev.email_institucional,
              unidade_id: String(fullForm.unidade_id || ""),
              unidade_path: fullForm.unidade_id
                ? [String(fullForm.unidade_id)]
                : [],
              respostas: (fullForm.respostas || [])
                .filter((r: any) => r.tipo === "tecnica" || !r.tipo)
                .map((r: any) => ({
                  competencia_unidade_id: r.competencia_unidade_id,
                  competencia_nome: r.competencia_nome,
                  competencia_descricao: r.competencia_descricao || "",
                  nota: String(r.nota || ""),
                  comentario: r.comentario || "",
                })),
              respostas_comportamentais: padraoComp.map((c) => {
                const existing = (fullForm.respostas || []).find(
                  (r: any) =>
                    r.tipo === "comportamental" &&
                    r.competencia_nome === c.nome,
                );
                return {
                  competencia_nome: c.nome,
                  competencia_descricao: c.descricao,
                  nota: existing ? String(existing.nota || "") : "",
                  comentario: existing?.comentario || "",
                };
              }),
              respostas_estrategicas: padraoEstr.map((c) => {
                const existing = (fullForm.respostas || []).find(
                  (r: any) =>
                    r.tipo === "estrategica" && r.competencia_nome === c.nome,
                );
                return {
                  competencia_nome: c.nome,
                  competencia_descricao: c.descricao,
                  nota: existing ? String(existing.nota || "") : "",
                  comentario: existing?.comentario || "",
                };
              }),
              respostas_gerenciais: padraoGer.map((c) => {
                const existing = (fullForm.respostas || []).find(
                  (r: any) =>
                    r.tipo === "gerencial" && r.competencia_nome === c.nome,
                );
                return {
                  competencia_nome: c.nome,
                  competencia_descricao: c.descricao,
                  nota: existing ? String(existing.nota || "") : "",
                  comentario: existing?.comentario || "",
                };
              }),
            }));
            // Se tem update_keys salvos, priorizar esses (autoritativos). Caso contrário, detectar por descrição.
            const storedUpdateKeys = (fullForm as any).update_keys;
            const hasStoredKeys =
              editMode &&
              storedUpdateKeys &&
              (Array.isArray(storedUpdateKeys.tecnicas) ||
                Array.isArray(storedUpdateKeys.padrao));

            if (fullForm.unidade_id) {
              loadCompetenciasEdit(
                fullForm.unidade_id,
                fullForm.respostas || [],
                hasStoredKeys,
              );
            }

            // Salvar versao_anterior para propagar no próximo submit
            if ((fullForm as any).versao_anterior) {
              setSavedVersaoAnterior((fullForm as any).versao_anterior);
            }

            if (hasStoredKeys) {
              if (Array.isArray(storedUpdateKeys.tecnicas))
                setChangedTecnicasKeys(new Set(storedUpdateKeys.tecnicas));
              if (Array.isArray(storedUpdateKeys.padrao))
                setChangedCompKeys(new Set(storedUpdateKeys.padrao));
            } else {
              // Detectar competências padrão alteradas comparando (nome+descricao) salvos vs atuais
              const changedPadrao = new Set<string>();
              const respostas = fullForm.respostas || [];
              const checkPadrao = (
                tipo: string,
                lista: { nome: string; descricao: string }[],
              ) => {
                const used = new Set<number>();
                lista.forEach((c) => {
                  const exactIdx = respostas.findIndex(
                    (r: any, i: number) =>
                      !used.has(i) &&
                      r.tipo === tipo &&
                      r.competencia_nome === c.nome &&
                      (r.competencia_descricao || "") === (c.descricao || ""),
                  );
                  if (exactIdx !== -1) {
                    used.add(exactIdx);
                    return;
                  }
                  const nameIdx = respostas.findIndex(
                    (r: any, i: number) =>
                      !used.has(i) &&
                      r.tipo === tipo &&
                      r.competencia_nome === c.nome,
                  );
                  if (nameIdx !== -1) used.add(nameIdx);
                  changedPadrao.add(`${c.nome}||${c.descricao || ""}`);
                });
              };
              checkPadrao("comportamental", padraoComp);
              if (tipoInventario === "gestor") {
                checkPadrao("estrategica", padraoEstr);
                checkPadrao("gerencial", padraoGer);
              }
              setChangedCompKeys(changedPadrao);
            }
          }
          setLoadingUnidades(false);
          return;
        }

        // Auto-selecionar se só tem 1 unidade autorizada
        if (autorizadas.length === 1) {
          const u = autorizadas[0];
          setForm((prev) => ({
            ...prev,
            unidade_id: String(u.id),
            unidade_path: [String(u.id)],
          }));
          loadCompetencias(u.id);
        }
      } catch (err) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      } finally {
        setLoadingUnidades(false);
      }
    };
    load();
  }, [tipoInventario, forceEditMode]);

  // Verifica se uma competência está travada (já preenchida e não foi alterada/adicionada na atualização)
  // Usa chave composta (nome||descricao) para diferenciar competências com mesmo nome
  const hasUpdateLock =
    forceEditMode ||
    (editMode && (changedCompKeys.size > 0 || changedTecnicasKeys.size > 0));
  const isCompLocked = (nome: string, descricao: string, nota: string) => {
    if (!hasUpdateLock) return false;
    return !!nota && !changedCompKeys.has(`${nome}||${descricao || ""}`);
  };

  // Handlers
  const updateField = (
    field: Exclude<keyof FormState, "respostas" | "unidade_path">,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateResposta = (
    index: number,
    field: "nota" | "comentario",
    value: string,
  ) => {
    setForm((prev) => {
      const respostas = [...prev.respostas];
      respostas[index] = { ...respostas[index], [field]: value };
      return { ...prev, respostas };
    });
  };

  const updateRespostaComportamental = (
    index: number,
    field: "nota" | "comentario",
    value: string,
  ) => {
    setForm((prev) => {
      const respostas_comportamentais = [...prev.respostas_comportamentais];
      respostas_comportamentais[index] = {
        ...respostas_comportamentais[index],
        [field]: value,
      };
      return { ...prev, respostas_comportamentais };
    });
  };

  const updateRespostaEstrategica = (
    index: number,
    field: "nota" | "comentario",
    value: string,
  ) => {
    setForm((prev) => {
      const respostas_estrategicas = [...prev.respostas_estrategicas];
      respostas_estrategicas[index] = {
        ...respostas_estrategicas[index],
        [field]: value,
      };
      return { ...prev, respostas_estrategicas };
    });
  };

  const updateRespostaGerencial = (
    index: number,
    field: "nota" | "comentario",
    value: string,
  ) => {
    setForm((prev) => {
      const respostas_gerenciais = [...prev.respostas_gerenciais];
      respostas_gerenciais[index] = {
        ...respostas_gerenciais[index],
        [field]: value,
      };
      return { ...prev, respostas_gerenciais };
    });
  };

  const handleSubmit = async () => {
    // Validação
    if (!form.nome_completo.trim())
      return toast.error("Informe o nome completo.");
    if (!form.matricula.trim()) return toast.error("Informe a matrícula.");
    if (!form.cargo_funcao.trim())
      return toast.error("Informe o cargo/função.");
    if (!form.email_institucional.trim())
      return toast.error("Informe o e-mail institucional.");
    if (!form.unidade_id) return toast.error("Selecione a unidade.");
    if (!form.nome_completo.trim())
      return toast.error("Digite seu nome completo.");

    if (form.respostas.length === 0) {
      return toast.error(
        "Nenhuma competência encontrada para a unidade selecionada.",
      );
    }

    for (let i = 0; i < form.respostas.length; i++) {
      const r = form.respostas[i];
      if (!r.nota) {
        return toast.error(
          `Selecione a nota para a competência técnica "${r.competencia_nome}".`,
        );
      }
    }

    for (let i = 0; i < form.respostas_comportamentais.length; i++) {
      const r = form.respostas_comportamentais[i];
      if (!r.nota) {
        return toast.error(
          `Selecione a nota para a competência comportamental "${r.competencia_nome}".`,
        );
      }
    }

    if (tipoInventario === "gestor") {
      for (let i = 0; i < form.respostas_estrategicas.length; i++) {
        const r = form.respostas_estrategicas[i];
        if (!r.nota) {
          return toast.error(
            `Selecione a nota para a competência estratégica "${r.competencia_nome}".`,
          );
        }
      }
      for (let i = 0; i < form.respostas_gerenciais.length; i++) {
        const r = form.respostas_gerenciais[i];
        if (!r.nota) {
          return toast.error(
            `Selecione a nota para a competência gerencial "${r.competencia_nome}".`,
          );
        }
      }
    }

    setSaving(true);
    try {
      const respostasTecnicas = form.respostas.map((r) => ({
        // Para gestor, não enviar competencia_unidade_id pois os IDs são de competencias_gestor_itens (FK incompatível)
        competencia_unidade_id:
          tipoInventario === "gestor" ? undefined : r.competencia_unidade_id,
        competencia_nome: r.competencia_nome,
        competencia_descricao: r.competencia_descricao,
        nota: Number(r.nota),
        comentario: r.comentario.trim() || undefined,
        tipo: "tecnica" as const,
      }));

      const respostasComportamentais = form.respostas_comportamentais.map(
        (r) => ({
          competencia_nome: r.competencia_nome,
          competencia_descricao: r.competencia_descricao,
          nota: Number(r.nota),
          comentario: r.comentario.trim() || undefined,
          tipo: "comportamental" as const,
        }),
      );

      const respostasEstrategicas =
        tipoInventario === "gestor"
          ? form.respostas_estrategicas.map((r) => ({
              competencia_nome: r.competencia_nome,
              competencia_descricao: r.competencia_descricao,
              nota: Number(r.nota),
              comentario: r.comentario.trim() || undefined,
              tipo: "estrategica" as const,
            }))
          : [];

      const respostasGerenciais =
        tipoInventario === "gestor"
          ? form.respostas_gerenciais.map((r) => ({
              competencia_nome: r.competencia_nome,
              competencia_descricao: r.competencia_descricao,
              nota: Number(r.nota),
              comentario: r.comentario.trim() || undefined,
              tipo: "gerencial" as const,
            }))
          : [];

      // Persistir estado de trava (chaves das competências editáveis) para preservar em edições subsequentes
      const updateKeys =
        forceEditMode ||
        changedCompKeys.size > 0 ||
        changedTecnicasKeys.size > 0
          ? {
              tecnicas: Array.from(changedTecnicasKeys),
              padrao: Array.from(changedCompKeys),
            }
          : null;

      const payload: any = {
        nome_completo: form.nome_completo.trim(),
        matricula: form.matricula.trim(),
        cargo_funcao: form.cargo_funcao.trim(),
        email_institucional: form.email_institucional.trim(),
        diretoria: diretoriaUsuario,
        unidade_id: form.unidade_id ? Number(form.unidade_id) : undefined,
        pessoa_id: form.pessoa_id ? Number(form.pessoa_id) : undefined,
        tipo_inventario: tipoInventario || "equipe",
        respostas: [
          ...respostasTecnicas,
          ...respostasComportamentais,
          ...respostasEstrategicas,
          ...respostasGerenciais,
        ],
        competencias_versao: compVersao || undefined,
        versao_anterior: savedVersaoAnterior || undefined,
        update_keys: updateKeys,
      };

      const result = await autoavaliacaoApi.create(payload);

      if (onSubmitted && result) onSubmitted(result);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  };

  // Bloqueio: usuário já preencheu — só desbloqueia se gestor excluir
  // Exceção: status 'atualizacao_requisitada' permite reabrir o formulário para atualizar
  if (jaPreenchido && jaPreenchido.status !== "atualizacao_requisitada") {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-2 border-emerald-200 bg-emerald-50">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <Info className="h-7 w-7 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-emerald-900">
              Autoavaliação já enviada
            </h3>
            <p className="text-sm text-emerald-700 max-w-md mx-auto">
              Você já enviou sua autoavaliação. Para preencher novamente, é
              necessário que o gestor exclua o formulário enviado.
            </p>
            <p className="text-xs text-emerald-600">
              Enviado em:{" "}
              {new Date(jaPreenchido.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {onViewResposta && (
              <Button
                onClick={() => onViewResposta(jaPreenchido)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
              >
                Visualizar Resposta
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Atualização requisitada: competências padrão foram alteradas, usuário precisa atualizar respostas
  if (jaPreenchido && jaPreenchido.status === "atualizacao_requisitada") {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mx-auto">
              <AlertCircle className="h-7 w-7 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-purple-900">
              Atualização Requisitada
            </h3>
            <p className="text-sm text-purple-700 max-w-md mx-auto">
              As competências padrão foram atualizadas. Por favor, revise e
              atualize suas respostas para as novas competências adicionadas ou
              modificadas.
            </p>
            <p className="text-xs text-purple-600">
              Enviado em:{" "}
              {new Date(jaPreenchido.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <div className="flex gap-3 justify-center mt-2">
              {onViewResposta && (
                <Button
                  variant="outline"
                  onClick={() => onViewResposta(jaPreenchido)}
                  className="border-purple-300 text-purple-700 hover:bg-purple-100"
                >
                  Visualizar Resposta
                </Button>
              )}
              <Button
                onClick={() => {
                  setSavedVersaoAnterior(
                    (jaPreenchido as any)?.competencias_versao || null,
                  );
                  setJaPreenchido(null);
                  setForceEditMode(true);
                  setLoadingUnidades(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Atualizar Respostas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Texto Introdutório */}
      <div className="rounded-xl bg-teal-50 border border-teal-200 p-8">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Info className="h-5 w-5 text-teal-600" />
          </div>
          <div className="text-base text-gray-700 space-y-4">
            <p className="font-semibold text-gray-900 text-lg">
              {tipoInventario === "gestor"
                ? "Autoavaliação do Gestor"
                : "Autoavaliação do Colaborador"}
            </p>
            <p>
              <strong className="text-gray-900">Objetivo:</strong>{" "}
              {tipoInventario === "gestor"
                ? "Este formulário tem como propósito registrar sua percepção sobre o nível de domínio das competências relacionadas à sua função de gestor."
                : "Este formulário tem como propósito registrar sua percepção sobre o nível de domínio das competências relacionadas à sua função."}
            </p>
            <p className="font-semibold text-gray-900">
              Orientações importantes:
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li>
                Responda com tranquilidade e sinceridade, lembrando que não há
                respostas certas ou erradas.
              </li>
              {tipoInventario === "gestor" ? (
                <li>
                  Reflita sobre sua atuação como gestor, destacando seus pontos
                  fortes e reconhecendo oportunidades de melhoria e
                  desenvolvimento.
                </li>
              ) : (
                <li>
                  Destaque seus pontos fortes e reconheça as oportunidades de
                  melhoria e desenvolvimento.
                </li>
              )}
              <li>
                {tipoInventario === "gestor"
                  ? "Para cada competência, apresente exemplos práticos do seu dia a dia de trabalho que evidenciem como você exerce ou busca desenvolver suas habilidades de gestão."
                  : "Para cada competência, apresente exemplos práticos do seu dia a dia de trabalho que evidenciem como você aplica ou busca desenvolver essas competências."}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Seção 1 - Identificação */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Identificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>
                Nome completo <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.nome_completo}
                onChange={(e) => updateField("nome_completo", e.target.value)}
                placeholder="Nome completo"
                className="mt-1"
                disabled={hasUpdateLock}
              />
            </div>
            <div>
              <Label>
                Matrícula <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.matricula}
                onChange={(e) => updateField("matricula", e.target.value)}
                placeholder="Matrícula"
                className="mt-1"
                disabled={hasUpdateLock}
              />
            </div>
            <div>
              <Label>
                Cargo/Função <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.cargo_funcao}
                onChange={(e) => updateField("cargo_funcao", e.target.value)}
                placeholder="Cargo ou função"
                className="mt-1"
                disabled={hasUpdateLock}
              />
            </div>
            <div>
              <Label>
                E-mail institucional <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                value={form.email_institucional}
                onChange={(e) =>
                  updateField("email_institucional", e.target.value)
                }
                placeholder="email@tjgo.jus.br"
                className="mt-1"
                disabled={hasUpdateLock}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 2 - Diretoria (automática) */}
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

      {/* Seção 3 - Unidade */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Unidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>
              Identificação da Unidade <span className="text-red-500">*</span>
            </Label>
            {loadingUnidades ? (
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
            ) : hasUpdateLock ? (
              <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                <p className="font-medium text-gray-800">
                  {unidadesAutorizadas.find(
                    (u) => String(u.id) === form.unidade_id,
                  )?.nome || "-"}
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
                  disabled={
                    tipoInventario === "gestor" &&
                    unidadesAutorizadas.length === 1
                  }
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

      {/* Seção 3.5 - Digite seu nome */}
      {form.unidade_id && (
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Identificação na Unidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>
              Digite seu nome completo <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Ex: João da Silva"
              value={form.nome_completo}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  nome_completo: e.target.value,
                  pessoa_id: "typed",
                }))
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Seção 4 - Competências Técnicas */}
      {form.unidade_id && form.nome_completo.trim() && (
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
                  Nesta seção, você encontrará competências técnicas
                  relacionadas às atividades da sua função.
                </p>
                <p className="font-semibold text-gray-900">
                  Para cada competência:
                </p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Faça sua autoavaliação em uma escala de 1 a 5.</li>
                  <li>
                    Registre comentários ou exemplos que evidenciem sua atuação.
                  </li>
                </ul>
                <p className="font-semibold text-gray-900">
                  Escala Técnica (1-5):
                </p>
                <EscalaLegenda items={ESCALA_NOTAS} />
              </div>
            </div>
          </div>

          {loadingCompetencias ? (
            <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando competências da unidade...
            </div>
          ) : competenciasUnidade.length === 0 ? (
            <Card className="border border-amber-200 bg-amber-50 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800">
                      Nenhuma competência cadastrada
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      Ainda não foram cadastradas competências técnicas para a
                      unidade selecionada. O gestor da unidade precisa cadastrar
                      as competências no Matriz de Competências antes que a
                      autoavaliação possa ser preenchida.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {form.respostas.map((resposta, index) => {
                const tecLocked =
                  hasUpdateLock &&
                  !!resposta.nota &&
                  !changedTecnicasKeys.has(
                    `${resposta.competencia_nome}||${resposta.competencia_descricao || ""}`,
                  );
                return (
                  <Card
                    key={index}
                    className={`border shadow-sm ${tecLocked ? "border-gray-100 bg-gray-50 opacity-70" : "border-gray-200"}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          <span className="text-teal-600 font-bold mr-2">
                            {index + 1}.
                          </span>
                          {resposta.competencia_nome}
                        </CardTitle>
                        {tecLocked && (
                          <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded">
                            Sem alteração
                          </span>
                        )}
                      </div>
                      {resposta.competencia_descricao && (
                        <p className="text-sm text-gray-500 mt-1 [overflow-wrap:anywhere]">
                          {resposta.competencia_descricao}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>
                          Nível de domínio{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <EscalaRadioGroup
                          items={ESCALA_NOTAS}
                          name={`nota-${index}`}
                          value={resposta.nota}
                          onChange={(v) => updateResposta(index, "nota", v)}
                          disabled={tecLocked}
                          accentColor="teal"
                        />
                      </div>
                      <div>
                        <Label>Comentário / Evidências</Label>
                        <Textarea
                          value={resposta.comentario}
                          onChange={(e) =>
                            updateResposta(index, "comentario", e.target.value)
                          }
                          placeholder="Descreva evidências ou justificativas para a nota atribuída (opcional)"
                          className="mt-1"
                          rows={3}
                          disabled={tecLocked}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </>
      )}

      {/* Seção 5 - Competências Comportamentais */}
      {form.respostas.length > 0 && (
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
                  Nesta seção, você encontrará competências relacionadas a
                  atitudes e comportamentos esperados no ambiente de trabalho.
                </p>
                <p className="font-semibold text-gray-900">
                  Para cada competência:
                </p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Faça sua autoavaliação em uma escala de 1 a 5.</li>
                  <li>
                    Registre comentários ou exemplos que evidenciem sua atuação.
                  </li>
                </ul>
                <p className="font-semibold text-gray-900">
                  Escala Comportamental (1-5):
                </p>
                <EscalaLegenda items={ESCALA_COMPORTAMENTAL} />
              </div>
            </div>
          </div>

          {form.respostas_comportamentais.map((resposta, index) => {
            const locked = isCompLocked(
              resposta.competencia_nome,
              resposta.competencia_descricao,
              resposta.nota,
            );
            return (
              <Card
                key={`comp-${index}`}
                className={`border shadow-sm ${locked ? "border-gray-100 bg-gray-50 opacity-70" : "border-gray-200"}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      <span className="text-violet-600 font-bold mr-2">
                        {index + 1}.
                      </span>
                      {resposta.competencia_nome}
                    </CardTitle>
                    {locked && (
                      <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded">
                        Sem alteração
                      </span>
                    )}
                  </div>
                  {resposta.competencia_descricao && (
                    <p className="text-sm text-gray-500 mt-1 [overflow-wrap:anywhere]">
                      {resposta.competencia_descricao}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>
                      Nível de desenvolvimento{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <EscalaRadioGroup
                      items={ESCALA_COMPORTAMENTAL}
                      name={`nota-comp-${index}`}
                      value={resposta.nota}
                      onChange={(v) =>
                        updateRespostaComportamental(index, "nota", v)
                      }
                      disabled={locked}
                      accentColor="violet"
                    />
                  </div>
                  <div>
                    <Label>Comentário / Evidências</Label>
                    <Textarea
                      value={resposta.comentario}
                      onChange={(e) =>
                        updateRespostaComportamental(
                          index,
                          "comentario",
                          e.target.value,
                        )
                      }
                      placeholder="Descreva evidências ou justificativas para a nota atribuída (opcional)"
                      className="mt-1"
                      rows={3}
                      disabled={locked}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {/* Seção 6 - Competências Estratégicas (somente gestor) */}
      {tipoInventario === "gestor" &&
        form.respostas.length > 0 &&
        form.respostas_estrategicas.length > 0 && (
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
                    Nesta seção, você encontrará competências relacionadas à
                    compreensão do contexto institucional e ao alinhamento das
                    atividades com os objetivos estratégicos da organização.
                  </p>
                  <p className="font-semibold text-gray-900">
                    Para cada competência:
                  </p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Faça sua autoavaliação em uma escala de 1 a 5.</li>
                    <li>
                      Registre comentários ou exemplos que evidenciem sua
                      atuação.
                    </li>
                  </ul>
                  <p className="font-semibold text-gray-900">
                    Escala Estratégica (1-5):
                  </p>
                  <EscalaLegenda items={ESCALA_ESTRATEGICA} />
                </div>
              </div>
            </div>

            {form.respostas_estrategicas.map((resposta, index) => {
              const locked = isCompLocked(
                resposta.competencia_nome,
                resposta.competencia_descricao,
                resposta.nota,
              );
              return (
                <Card
                  key={`estr-${index}`}
                  className={`border shadow-sm ${locked ? "border-gray-100 bg-gray-50 opacity-70" : "border-gray-200"}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        <span className="text-blue-600 font-bold mr-2">
                          {index + 1}.
                        </span>
                        {resposta.competencia_nome}
                      </CardTitle>
                      {locked && (
                        <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded">
                          Sem alteração
                        </span>
                      )}
                    </div>
                    {resposta.competencia_descricao && (
                      <p className="text-sm text-gray-500 mt-1 [overflow-wrap:anywhere]">
                        {resposta.competencia_descricao}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>
                        Nível de domínio <span className="text-red-500">*</span>
                      </Label>
                      <EscalaRadioGroup
                        items={ESCALA_ESTRATEGICA}
                        name={`nota-estr-${index}`}
                        value={resposta.nota}
                        onChange={(v) =>
                          updateRespostaEstrategica(index, "nota", v)
                        }
                        disabled={locked}
                        accentColor="blue"
                      />
                    </div>
                    <div>
                      <Label>Comentário / Evidências</Label>
                      <Textarea
                        value={resposta.comentario}
                        onChange={(e) =>
                          updateRespostaEstrategica(
                            index,
                            "comentario",
                            e.target.value,
                          )
                        }
                        placeholder="Descreva evidências ou justificativas para a nota atribuída (opcional)"
                        className="mt-1"
                        rows={3}
                        disabled={locked}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}

      {/* Seção 7 - Competências Gerenciais (somente gestor) */}
      {tipoInventario === "gestor" &&
        form.respostas.length > 0 &&
        form.respostas_gerenciais.length > 0 && (
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
                    Nesta seção, você encontrará competências relacionadas à
                    liderança de equipes e à condução das atividades de gestão
                    da unidade.
                  </p>
                  <p className="font-semibold text-gray-900">
                    Para cada competência:
                  </p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Faça sua autoavaliação em uma escala de 1 a 5.</li>
                    <li>
                      Registre comentários ou exemplos que evidenciem sua
                      atuação.
                    </li>
                  </ul>
                  <p className="font-semibold text-gray-900">
                    Escala Gerencial (1-5):
                  </p>
                  <EscalaLegenda items={ESCALA_GERENCIAL} />
                </div>
              </div>
            </div>

            {form.respostas_gerenciais.map((resposta, index) => {
              const locked = isCompLocked(
                resposta.competencia_nome,
                resposta.competencia_descricao,
                resposta.nota,
              );
              return (
                <Card
                  key={`ger-${index}`}
                  className={`border shadow-sm ${locked ? "border-gray-100 bg-gray-50 opacity-70" : "border-gray-200"}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        <span className="text-rose-600 font-bold mr-2">
                          {index + 1}.
                        </span>
                        {resposta.competencia_nome}
                      </CardTitle>
                      {locked && (
                        <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded">
                          Sem alteração
                        </span>
                      )}
                    </div>
                    {resposta.competencia_descricao && (
                      <p className="text-sm text-gray-500 mt-1 [overflow-wrap:anywhere]">
                        {resposta.competencia_descricao}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>
                        Nível de domínio <span className="text-red-500">*</span>
                      </Label>
                      <EscalaRadioGroup
                        items={ESCALA_GERENCIAL}
                        name={`nota-ger-${index}`}
                        value={resposta.nota}
                        onChange={(v) =>
                          updateRespostaGerencial(index, "nota", v)
                        }
                        disabled={locked}
                        accentColor="rose"
                      />
                    </div>
                    <div>
                      <Label>Comentário / Evidências</Label>
                      <Textarea
                        value={resposta.comentario}
                        onChange={(e) =>
                          updateRespostaGerencial(
                            index,
                            "comentario",
                            e.target.value,
                          )
                        }
                        placeholder="Descreva evidências ou justificativas para a nota atribuída (opcional)"
                        className="mt-1"
                        rows={3}
                        disabled={locked}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}

      {/* Botão Enviar */}
      {form.respostas.length > 0 && (
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
                Enviar autoavaliação
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
