import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { areasApi } from "@/services/areasApi";
import {
  competenciasGestorApi,
  CompetenciaPorUnidade,
  UnidadeAutorizada,
} from "@/services/competenciasGestorApi";
import {
  avaliacaoGestorApi,
  AvaliacaoGestorFormulario,
  GestorDaUnidade,
} from "@/services/avaliacaoGestorApi";
import { autoavaliacaoApi } from "@/services/autoavaliacaoApi";
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
import {
  Loader2,
  Send,
  Info,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

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
  pessoa_id: string;
  /** user_id da pessoa avaliada (gestor da unidade) quando não há autoavaliação. */
  pessoa_user_id: string;
  pessoa_nome: string;
  pessoa_cargo: string;
  pessoa_email: string;
  unidade_id: string;
  unidade_path: string[];
  respostas: RespostaState[];
  respostas_comportamentais: RespostaComportamentalState[];
  respostas_estrategicas: RespostaComportamentalState[];
  respostas_gerenciais: RespostaComportamentalState[];
}

interface AvaliacaoGestorFormProps {
  tipoInventario?: "equipe" | "gestor";
  onSubmitted?: (formulario: AvaliacaoGestorFormulario) => void;
  formularioEdit?: AvaliacaoGestorFormulario;
}

export function AvaliacaoGestorForm({
  onSubmitted,
  tipoInventario,
  formularioEdit,
}: AvaliacaoGestorFormProps) {
  const isEditMode = !!formularioEdit;
  const { user } = useAuth();

  const [unidadesAutorizadas, setUnidadesAutorizadas] = useState<
    UnidadeAutorizada[]
  >([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diretoriaUsuario, setDiretoriaUsuario] = useState<string>("");

  const [competenciasUnidade, setCompetenciasUnidade] = useState<
    CompetenciaPorUnidade[]
  >([]);
  const [loadingCompetencias, setLoadingCompetencias] = useState(false);
  // Conjunto de chaves "nome||descricao" das competências técnicas que MUDARAM em relação à v1.
  // Em modo de edição (re-fill após atualização requisitada), as não-alteradas vêm travadas
  // (notas/comentários da v1 preservados); só as alteradas/novas são editáveis.
  const [changedTecnicasKeys, setChangedTecnicasKeys] = useState<Set<string>>(
    new Set(),
  );
  const isTecChanged = (nome: string, descricao: string | null | undefined) =>
    changedTecnicasKeys.has(`${nome}||${descricao || ""}`);
  // Mesma ideia para competências PADRÃO (comportamentais/estratégicas/gerenciais).
  const [changedCompKeys, setChangedCompKeys] = useState<Set<string>>(
    new Set(),
  );
  const isCompChanged = (nome: string, descricao: string | null | undefined) =>
    changedCompKeys.has(`${nome}||${descricao || ""}`);

  const [autoavaliacoes, setAutoavaliacoes] = useState<
    {
      id: number;
      nome_completo: string;
      cargo_funcao: string;
      email_institucional: string;
      unidade_id: number;
    }[]
  >([]);
  const [loadingPessoas, setLoadingPessoas] = useState(false);
  // Gestor da unidade (do cadastro) como avaliável, mesmo sem autoavaliação — só no inventário "gestor".
  const [gestorUnidade, setGestorUnidade] = useState<GestorDaUnidade | null>(
    null,
  );

  // Competências padrão carregadas da API (com fallback para constantes)
  const [compComportamentais, setCompComportamentais] = useState(
    COMPETENCIAS_COMPORTAMENTAIS,
  );
  const [compEstrategicas, setCompEstrategicas] = useState(
    COMPETENCIAS_ESTRATEGICAS,
  );
  const [compGerenciais, setCompGerenciais] = useState(COMPETENCIAS_GERENCIAIS);

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
      })
      .catch(() => {});
  }, []);

  // Quando os padrões chegam da API depois do mount, reconstrói os blocos de
  // respostas_* preservando notas/comentários já preenchidos. Sem isso, o form
  // ficaria travado nos padrões hardcoded das constantes (v1) em vez dos padrões
  // correntes publicados.
  useEffect(() => {
    if (isEditMode) return; // edit mode é tratado em outros effects
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
  }, [compComportamentais, compEstrategicas, compGerenciais, isEditMode]);

  const [form, setForm] = useState<FormState>({
    pessoa_id: "",
    pessoa_user_id: "",
    pessoa_nome: "",
    pessoa_cargo: "",
    pessoa_email: "",
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
      pessoa_user_id: "",
      pessoa_nome: "",
      pessoa_cargo: "",
      pessoa_email: "",
      respostas: [],
    }));
    setGestorUnidade(null);
    loadCompetencias(Number(value));
    loadPessoas(Number(value));
  };

  // Carregar avaliáveis da unidade.
  // - Equipe: lista as autoavaliações (o avaliador escolhe o colaborador).
  // - Gestor: só existe UM gestor por unidade, então já vem auto-selecionado (não há dropdown).
  const loadPessoas = async (unidadeId: number) => {
    setLoadingPessoas(true);
    try {
      const avals = await autoavaliacaoApi.getByUnidade(
        unidadeId,
        tipoInventario || "equipe",
      );
      setAutoavaliacoes(avals);

      if (tipoInventario === "gestor") {
        let g: GestorDaUnidade | null = null;
        try {
          g = await avaliacaoGestorApi.getGestorDaUnidade(unidadeId, "gestor");
        } catch {
          g = null;
        }
        setGestorUnidade(g);
        if (g) {
          // Auto-seleciona o gestor da unidade como avaliado. Usa a autoavaliação (pessoa_id) se
          // ele já se autoavaliou; senão, a chave estável (pessoa_user_id).
          const usaAuto = g.autoavaliacao_id != null;
          setForm((prev) => ({
            ...prev,
            pessoa_id: usaAuto ? String(g!.autoavaliacao_id) : "",
            pessoa_user_id: usaAuto ? "" : String(g!.pessoa_user_id),
            pessoa_nome: g!.nome || "",
            pessoa_cargo: g!.cargo || "",
            pessoa_email: g!.email || "",
          }));
          try {
            const existente = usaAuto
              ? await avaliacaoGestorApi.getByPessoaAndUnidade(
                  g.autoavaliacao_id!,
                  unidadeId,
                )
              : await avaliacaoGestorApi.getByPessoaAndUnidade(
                  g.pessoa_user_id,
                  unidadeId,
                  "user",
                );
            setAvaliacaoExistente(existente);
          } catch {
            setAvaliacaoExistente(null);
          }
        }
      }
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingPessoas(false);
    }
  };

  // Handler para selecao de colaborador (a partir das autoavaliações)
  // Quando uma avaliação existente é detectada para a pessoa+unidade, guardamos para mostrar
  // banner de "atualização requisitada" e habilitar a lógica de campos travados.
  const [avaliacaoExistente, setAvaliacaoExistente] =
    useState<AvaliacaoGestorFormulario | null>(null);

  /**
   * A pessoa+unidade selecionada JÁ tem avaliação enviada. Só `atualizacao_requisitada`
   * reabre o preenchimento; nos demais status é preciso bloquear, senão o create do backend
   * insere uma linha nova (o dedup de lá só reaproveita formulário ainda não validado) e o
   * mesmo gestor termina com duas avaliações.
   */
  const jaAvaliado =
    !isEditMode &&
    !!avaliacaoExistente &&
    avaliacaoExistente.status !== "atualizacao_requisitada";

  /**
   * Só faz sentido renderizar a matriz de competências e o envio quando há alguém pendente
   * de avaliação. Com a pessoa já avaliada, a tela fica só com o aviso — sem escala, sem
   * lista de competências e sem botão.
   */
  const mostrarCompetencias =
    !jaAvaliado &&
    !!form.unidade_id &&
    (!!form.pessoa_id || !!form.pessoa_user_id);

  // Dispatcher do dropdown: "auto:<id>" = a partir de uma autoavaliação; "user:<userId>" = o gestor
  // da unidade (sem autoavaliação).
  const handleAvaliavelSelect = (key: string) => {
    if (key.startsWith("user:")) {
      if (gestorUnidade) handleGestorSelect(gestorUnidade);
    } else {
      handlePessoaSelect(key.replace(/^auto:/, ""));
    }
  };

  const handleGestorSelect = async (g: GestorDaUnidade) => {
    setForm((prev) => ({
      ...prev,
      pessoa_id: "",
      pessoa_user_id: String(g.pessoa_user_id),
      pessoa_nome: g.nome || "",
      pessoa_cargo: g.cargo || "",
      pessoa_email: g.email || "",
    }));
    try {
      const existente = await avaliacaoGestorApi.getByPessoaAndUnidade(
        g.pessoa_user_id,
        Number(form.unidade_id),
        "user",
      );
      setAvaliacaoExistente(existente);
    } catch {
      setAvaliacaoExistente(null);
    }
  };

  const handlePessoaSelect = async (avalId: string) => {
    const aval = autoavaliacoes.find((a) => String(a.id) === avalId);
    if (!aval) return;

    setForm((prev) => ({
      ...prev,
      pessoa_id: avalId,
      pessoa_user_id: "",
      pessoa_nome: aval.nome_completo,
      pessoa_cargo: aval.cargo_funcao || "",
      pessoa_email: aval.email_institucional || "",
    }));

    // Auto-detectar avaliação existente para esta pessoa+unidade.
    // Se houver e estiver em atualizacao_requisitada, carregar respostas v1 + travar inalteradas.
    try {
      const existente = await avaliacaoGestorApi.getByPessoaAndUnidade(
        Number(aval.id),
        aval.unidade_id,
      );
      setAvaliacaoExistente(existente);
      if (
        existente &&
        existente.status === "atualizacao_requisitada" &&
        existente.respostas
      ) {
        const tecnicas = (existente.respostas || []).filter(
          (r: any) => (r.tipo || "tecnica") === "tecnica",
        );
        if (existente.unidade_id) {
          await loadCompetenciasEdit(existente.unidade_id, tecnicas);
        }

        // Carregar competências PADRÃO atuais direto da API (evita race com o useState)
        // e mesclar com as respostas v1, travando as inalteradas.
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

        const respostasV1 = existente.respostas || [];
        const buildPadrao = (
          tipo: "comportamental" | "estrategica" | "gerencial",
          lista: { nome: string; descricao: string }[],
        ) => {
          const used = new Set<number>();
          return lista.map((c) => {
            const exactIdx = respostasV1.findIndex(
              (r: any, i: number) =>
                !used.has(i) &&
                r.tipo === tipo &&
                r.competencia_nome === c.nome &&
                (r.competencia_descricao || "") === (c.descricao || ""),
            );
            if (exactIdx !== -1) {
              used.add(exactIdx);
              const ex: any = respostasV1[exactIdx];
              return {
                competencia_nome: c.nome,
                competencia_descricao: c.descricao,
                nota: String(ex.nota || ""),
                comentario: ex.comentario || "",
              };
            }
            const nameIdx = respostasV1.findIndex(
              (r: any, i: number) =>
                !used.has(i) &&
                r.tipo === tipo &&
                r.competencia_nome === c.nome,
            );
            if (nameIdx !== -1) {
              used.add(nameIdx);
              const ex: any = respostasV1[nameIdx];
              return {
                competencia_nome: c.nome,
                competencia_descricao: c.descricao,
                nota: String(ex.nota || ""),
                comentario: ex.comentario || "",
              };
            }
            return {
              competencia_nome: c.nome,
              competencia_descricao: c.descricao,
              nota: "",
              comentario: "",
            };
          });
        };

        const respComp = buildPadrao("comportamental", padraoComp);
        const respEstr = buildPadrao("estrategica", padraoEstr);
        const respGer = buildPadrao("gerencial", padraoGer);

        setForm((prev) => ({
          ...prev,
          respostas_comportamentais: respComp,
          respostas_estrategicas: respEstr,
          respostas_gerenciais: respGer,
        }));

        // Detectar quais padrão mudaram comparando v1 com competências atuais.
        const storedUpdateKeys = (existente as any).update_keys;
        if (storedUpdateKeys && Array.isArray(storedUpdateKeys.padrao)) {
          setChangedCompKeys(new Set(storedUpdateKeys.padrao));
        } else {
          const changedPadrao = new Set<string>();
          const checkPadrao = (
            tipo: string,
            lista: { nome: string; descricao: string }[],
          ) => {
            const usedDet = new Set<number>();
            lista.forEach((c) => {
              const exactIdx = respostasV1.findIndex(
                (r: any, i: number) =>
                  !usedDet.has(i) &&
                  r.tipo === tipo &&
                  r.competencia_nome === c.nome &&
                  (r.competencia_descricao || "") === (c.descricao || ""),
              );
              if (exactIdx !== -1) {
                usedDet.add(exactIdx);
                return;
              }
              const nameIdx = respostasV1.findIndex(
                (r: any, i: number) =>
                  !usedDet.has(i) &&
                  r.tipo === tipo &&
                  r.competencia_nome === c.nome,
              );
              if (nameIdx !== -1) usedDet.add(nameIdx);
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
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  // Carregar competencias da unidade selecionada
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
      // Criar respostas iniciais para cada competencia
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

  // Carregar competências em modo de edição (re-fill após atualização requisitada).
  // Faz match das respostas existentes com as competências atuais da unidade:
  //   1. Match exato (nome + descrição) → preserva nota, NÃO marca como alterada (vem travada)
  //   2. Match por nome (descrição mudou) → preserva nota, marca como alterada (editável)
  //   3. Match por posição (renomeada) → preserva nota, marca como alterada (editável)
  //   4. Sem match (nova) → nota em branco, marca como alterada (editável)
  const loadCompetenciasEdit = async (
    unidadeId: number,
    respostasTecnicasExistentes: any[],
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

      const novasRespostas = competencias.map((c) => {
        // 1) Match exato: mesmo nome + mesma descrição → não mudou (vem travada)
        const exactIdx = respostasTecnicasExistentes.findIndex(
          (r: any, i: number) =>
            !usedIdx.has(i) &&
            r.competencia_nome === c.nome &&
            (r.competencia_descricao || "") === (c.descricao || ""),
        );
        if (exactIdx !== -1) {
          usedIdx.add(exactIdx);
          const ex = respostasTecnicasExistentes[exactIdx];
          return {
            competencia_unidade_id: c.id,
            competencia_nome: c.nome,
            competencia_descricao: c.descricao,
            nota: String(ex.nota || ""),
            comentario: ex.comentario || "",
          };
        }
        // 2) Match por nome: descrição mudou → preservar nota, marcar como alterada
        const nameIdx = respostasTecnicasExistentes.findIndex(
          (r: any, i: number) =>
            !usedIdx.has(i) && r.competencia_nome === c.nome,
        );
        if (nameIdx !== -1) {
          usedIdx.add(nameIdx);
          const ex = respostasTecnicasExistentes[nameIdx];
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
        const posIdx = respostasTecnicasExistentes.findIndex(
          (r: any, i: number) => !usedIdx.has(i),
        );
        if (posIdx !== -1) {
          usedIdx.add(posIdx);
          const ex = respostasTecnicasExistentes[posIdx];
          changedTec.add(`${c.nome}||${c.descricao || ""}`);
          return {
            competencia_unidade_id: c.id,
            competencia_nome: c.nome,
            competencia_descricao: c.descricao,
            nota: String(ex.nota || ""),
            comentario: ex.comentario || "",
          };
        }
        // 4) Competência genuinamente nova → editável
        changedTec.add(`${c.nome}||${c.descricao || ""}`);
        return {
          competencia_unidade_id: c.id,
          competencia_nome: c.nome,
          competencia_descricao: c.descricao,
          nota: "",
          comentario: "",
        };
      });

      setChangedTecnicasKeys(changedTec);
      setForm((prev) => ({ ...prev, respostas: novasRespostas }));
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
        const fetchUnidades =
          tipoInventario === "gestor"
            ? competenciasGestorApi.getUnidadesLideranca()
            : competenciasGestorApi.getMinhasUnidadesGestor();

        const [allAreas, autorizadas, idsComMatriz] = await Promise.all([
          areasApi.getAll(),
          fetchUnidades,
          competenciasGestorApi.getUnidadesComMatriz(tipoInventario || "gestor"),
        ]);

        if (allAreas.length > 0) {
          const userArea =
            allAreas.find((a) => a.sigla === user?.diretoria) ||
            allAreas.find((a) => a.is_domain_root === true) ||
            allAreas[0];
          setDiretoriaUsuario(userArea?.sigla || userArea?.nome || "");
        }

        // Só unidades com a Matriz de Competências validada (há referencial para avaliar).
        // Em modo edição, preserva a unidade do formulário mesmo que não esteja na lista.
        // Coage ambos os lados para número: o backend serializa bigint como string e int4
        // como número, então a interseção falharia por tipo (Set<string> vs id number).
        const idsSet = new Set(idsComMatriz.map((id) => Number(id)));
        const unidadesFiltradas = autorizadas.filter(
          (u) =>
            idsSet.has(Number(u.id)) ||
            Number(u.id) === Number(formularioEdit?.unidade_id),
        );
        setUnidadesAutorizadas(unidadesFiltradas);

        if (isEditMode && formularioEdit) {
          const tecnicas = (formularioEdit.respostas || []).filter(
            (r) => (r.tipo || "tecnica") === "tecnica",
          );
          const respostasV1 = formularioEdit.respostas || [];

          // Carregar competências atuais da unidade e fazer matching com as respostas v1
          // (preenche competenciasUnidade + form.respostas + changedTecnicasKeys).
          if (formularioEdit.unidade_id) {
            await loadCompetenciasEdit(formularioEdit.unidade_id, tecnicas);
          }

          // Buscar competências PADRÃO atuais direto da API (evita race com o useState)
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

          const buildPadrao = (
            tipo: "comportamental" | "estrategica" | "gerencial",
            lista: { nome: string; descricao: string }[],
          ) => {
            const used = new Set<number>();
            return lista.map((c) => {
              const exactIdx = respostasV1.findIndex(
                (r: any, i: number) =>
                  !used.has(i) &&
                  r.tipo === tipo &&
                  r.competencia_nome === c.nome &&
                  (r.competencia_descricao || "") === (c.descricao || ""),
              );
              if (exactIdx !== -1) {
                used.add(exactIdx);
                const ex: any = respostasV1[exactIdx];
                return {
                  competencia_nome: c.nome,
                  competencia_descricao: c.descricao,
                  nota: String(ex.nota || ""),
                  comentario: ex.comentario || "",
                };
              }
              const nameIdx = respostasV1.findIndex(
                (r: any, i: number) =>
                  !used.has(i) &&
                  r.tipo === tipo &&
                  r.competencia_nome === c.nome,
              );
              if (nameIdx !== -1) {
                used.add(nameIdx);
                const ex: any = respostasV1[nameIdx];
                return {
                  competencia_nome: c.nome,
                  competencia_descricao: c.descricao,
                  nota: String(ex.nota || ""),
                  comentario: ex.comentario || "",
                };
              }
              return {
                competencia_nome: c.nome,
                competencia_descricao: c.descricao,
                nota: "",
                comentario: "",
              };
            });
          };

          setForm((prev) => ({
            ...prev,
            pessoa_id: formularioEdit.pessoa_id
              ? String(formularioEdit.pessoa_id)
              : "",
            pessoa_user_id: formularioEdit.pessoa_user_id
              ? String(formularioEdit.pessoa_user_id)
              : "",
            pessoa_nome: formularioEdit.pessoa_nome,
            pessoa_cargo: formularioEdit.pessoa_cargo || "",
            pessoa_email: formularioEdit.pessoa_email || "",
            unidade_id: formularioEdit.unidade_id
              ? String(formularioEdit.unidade_id)
              : "",
            unidade_path: formularioEdit.unidade_id
              ? [String(formularioEdit.unidade_id)]
              : [],
            // respostas técnicas: já preenchidas por loadCompetenciasEdit acima
            respostas_comportamentais: buildPadrao(
              "comportamental",
              padraoComp,
            ),
            respostas_estrategicas: buildPadrao("estrategica", padraoEstr),
            respostas_gerenciais: buildPadrao("gerencial", padraoGer),
          }));

          // Detectar quais padrão mudaram em relação à v1.
          const storedUpdateKeys = (formularioEdit as any).update_keys;
          if (storedUpdateKeys && Array.isArray(storedUpdateKeys.padrao)) {
            setChangedCompKeys(new Set(storedUpdateKeys.padrao));
          } else {
            const changedPadrao = new Set<string>();
            const checkPadrao = (
              tipo: string,
              lista: { nome: string; descricao: string }[],
            ) => {
              const usedDet = new Set<number>();
              lista.forEach((c) => {
                const exactIdx = respostasV1.findIndex(
                  (r: any, i: number) =>
                    !usedDet.has(i) &&
                    r.tipo === tipo &&
                    r.competencia_nome === c.nome &&
                    (r.competencia_descricao || "") === (c.descricao || ""),
                );
                if (exactIdx !== -1) {
                  usedDet.add(exactIdx);
                  return;
                }
                const nameIdx = respostasV1.findIndex(
                  (r: any, i: number) =>
                    !usedDet.has(i) &&
                    r.tipo === tipo &&
                    r.competencia_nome === c.nome,
                );
                if (nameIdx !== -1) usedDet.add(nameIdx);
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
        } else if (unidadesFiltradas.length === 1) {
          // Auto-seleciona quando só há UMA unidade com matriz validada — mesmo que o
          // usuário lidere várias unidades (só uma tem referencial p/ avaliar). Sem isso,
          // a unidade aparece read-only mas o gestor/competências não carregam.
          const u = unidadesFiltradas[0];
          setForm((prev) => ({
            ...prev,
            unidade_id: String(u.id),
            unidade_path: [String(u.id)],
          }));
          loadCompetencias(u.id);
          loadPessoas(u.id);
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
    // Validacao
    if (jaAvaliado) {
      return toast.error(
        `${form.pessoa_nome || "Esta pessoa"} já tem avaliação enviada nesta unidade.`,
      );
    }
    if (!form.unidade_id) return toast.error("Selecione a unidade.");
    if (!form.pessoa_id && !form.pessoa_user_id)
      return toast.error("Selecione o colaborador a ser avaliado.");

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

      const payload = {
        pessoa_id: form.pessoa_id ? Number(form.pessoa_id) : undefined,
        pessoa_user_id: form.pessoa_user_id
          ? Number(form.pessoa_user_id)
          : undefined,
        pessoa_nome: form.pessoa_nome.trim(),
        pessoa_cargo: form.pessoa_cargo.trim() || undefined,
        pessoa_email: form.pessoa_email.trim() || undefined,
        avaliador_nome: user?.name || "",
        diretoria: diretoriaUsuario,
        unidade_id: form.unidade_id ? Number(form.unidade_id) : undefined,
        tipo_inventario: tipoInventario || "equipe",
        respostas: [
          ...respostasTecnicas,
          ...respostasComportamentais,
          ...respostasEstrategicas,
          ...respostasGerenciais,
        ],
      };

      const result = await avaliacaoGestorApi.create(payload);

      if (onSubmitted && result) onSubmitted(result);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  };

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
              <strong className="text-gray-900">Objetivo:</strong> Este
              formulário tem como finalidade possibilitar que o gestor avalie as
              competências técnicas e comportamentais de cada colaborador de sua
              equipe, identificando o nível de domínio em cada uma delas.
            </p>
            <p>
              As competências técnicas listadas foram previamente definidas na
              Matriz de Competências da unidade.
            </p>
            <p className="font-semibold text-gray-900">Orientações:</p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Selecione a unidade de lotação do colaborador.</li>
              <li>Selecione o colaborador a ser avaliado.</li>
              <li>
                Para cada competência, selecione o nível que melhor representa o
                domínio atual do colaborador.
              </li>
              <li>
                Utilize o campo de comentários/evidências para justificar sua
                avaliação, quando aplicável.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Secao 1 - Identificacao do Avaliador (read-only) */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Avaliador</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            <span className="text-sm text-gray-500">Nome do Avaliador</span>
            <p className="font-medium text-gray-800 mt-0.5">
              {user?.name || "-"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Secao 2 - Diretoria (automatica) */}
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

      {/* Secao 3 - Unidade */}
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

      {/* Secao 4 - Selecao do Colaborador (a partir das autoavaliações) */}
      {form.unidade_id && (
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Colaborador a ser Avaliado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>
              {tipoInventario === "gestor"
                ? "Gestor da unidade (avaliado)"
                : "Selecione o colaborador a ser avaliado"}{" "}
              {!isEditMode && <span className="text-red-500">*</span>}
            </Label>
            {isEditMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                  <span className="text-sm text-gray-500">Nome</span>
                  <p className="font-medium text-gray-800 mt-0.5">
                    {form.pessoa_nome}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                  <span className="text-sm text-gray-500">Cargo/Função</span>
                  <p className="font-medium text-gray-800 mt-0.5">
                    {form.pessoa_cargo || "-"}
                  </p>
                </div>
              </div>
            ) : loadingPessoas ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando…
              </div>
            ) : tipoInventario === "gestor" ? (
              // Só um gestor por unidade → auto-selecionado (sem dropdown).
              gestorUnidade ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                    <span className="text-sm text-gray-500">Nome</span>
                    <p className="font-medium text-gray-800 mt-0.5">
                      {form.pessoa_nome || gestorUnidade.nome}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                    <span className="text-sm text-gray-500">Cargo/Função</span>
                    <p className="font-medium text-gray-800 mt-0.5">
                      {form.pessoa_cargo || "-"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-700">
                    Esta unidade não tem gestor cadastrado (defina o responsável
                    no cadastro da unidade).
                  </p>
                </div>
              )
            ) : autoavaliacoes.length === 0 ? (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700">
                  Nenhum colaborador realizou a autoavaliação nesta unidade
                  ainda.
                </p>
              </div>
            ) : (
              <>
                <Select
                  value={
                    form.pessoa_user_id
                      ? `user:${form.pessoa_user_id}`
                      : form.pessoa_id
                        ? `auto:${form.pessoa_id}`
                        : ""
                  }
                  onValueChange={handleAvaliavelSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o colaborador" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {gestorUnidade && (
                      <SelectItem
                        value={`user:${gestorUnidade.pessoa_user_id}`}
                      >
                        {gestorUnidade.nome}
                        {gestorUnidade.cargo ? ` — ${gestorUnidade.cargo}` : ""}
                        {" (gestor — sem autoavaliação)"}
                      </SelectItem>
                    )}
                    {autoavaliacoes.map((a) => (
                      <SelectItem key={a.id} value={`auto:${a.id}`}>
                        {a.nome_completo}
                        {a.cargo_funcao ? ` — ${a.cargo_funcao}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(form.pessoa_id || form.pessoa_user_id) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                      <span className="text-sm text-gray-500">Nome</span>
                      <p className="font-medium text-gray-800 mt-0.5">
                        {form.pessoa_nome}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                      <span className="text-sm text-gray-500">
                        Cargo/Função
                      </span>
                      <p className="font-medium text-gray-800 mt-0.5">
                        {form.pessoa_cargo || "-"}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Avaliação já enviada para esta pessoa+unidade: avisa e trava o envio. */}
            {jaAvaliado && (
              <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg mt-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-emerald-800 space-y-1">
                  <p className="font-semibold">
                    {form.pessoa_nome || "Esta pessoa"} já foi avaliado nesta
                    unidade.
                  </p>
                  <p className="text-emerald-700">
                    {avaliacaoExistente?.validado_em
                      ? `Avaliação validada em ${new Date(avaliacaoExistente.validado_em).toLocaleDateString("pt-BR")}.`
                      : "A avaliação já foi enviada e aguarda validação."}{" "}
                    Para preencher de novo, é preciso que a avaliação seja
                    recusada ou tenha atualização requisitada.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Secao 5 - Competencias Tecnicas */}
      {/* pessoa_id OU pessoa_user_id: no fluxo de avaliar o gestor sem autoavaliacao so ha
          pessoa_user_id, e a secao (com a matriz da unidade) precisa aparecer igual. */}
      {mostrarCompetencias && (
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
                  Avalie o nível de domínio do colaborador em cada competência
                  técnica listada abaixo.
                </p>
                <p>Utilize a seguinte escala:</p>
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
                      as competências na Matriz de Competências antes que a
                      avaliação possa ser preenchida.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {form.respostas.map((resposta, index) => {
                const isChanged = isTecChanged(
                  resposta.competencia_nome,
                  resposta.competencia_descricao,
                );
                // Modo edição: via prop formularioEdit OU via auto-detecção de avaliação
                // existente em atualizacao_requisitada quando o gestor seleciona a pessoa.
                const isInEditMode =
                  isEditMode ||
                  avaliacaoExistente?.status === "atualizacao_requisitada";
                // Só competências alteradas/novas são editáveis. Demais travadas (v1 preservada).
                const isLocked = isInEditMode && !isChanged;
                return (
                  <Card
                    key={index}
                    className={`border shadow-sm ${isLocked ? "border-gray-200 bg-gray-50" : isInEditMode && isChanged ? "border-amber-300 bg-amber-50/30" : "border-gray-200"}`}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-teal-600 font-bold mr-2">
                          {index + 1}.
                        </span>
                        <span className="flex-1">
                          {resposta.competencia_nome}
                        </span>
                        {isInEditMode && isChanged && (
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
                          disabled={isLocked}
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
                          disabled={isLocked}
                          className="mt-1"
                          rows={3}
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

      {/* Secao 6 - Competencias Comportamentais */}
      {mostrarCompetencias && form.respostas.length > 0 && (
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
                  Avalie o nível de desenvolvimento do colaborador em cada
                  competência comportamental listada abaixo.
                </p>
                <p>Utilize a seguinte escala:</p>
                <EscalaLegenda items={ESCALA_COMPORTAMENTAL} />
              </div>
            </div>
          </div>

          {form.respostas_comportamentais.map((resposta, index) => {
            const isInEditMode =
              isEditMode ||
              avaliacaoExistente?.status === "atualizacao_requisitada";
            const isChanged = isCompChanged(
              resposta.competencia_nome,
              resposta.competencia_descricao,
            );
            const isLocked = isInEditMode && !isChanged;
            return (
              <Card
                key={`comp-${index}`}
                className={`border shadow-sm ${isLocked ? "border-gray-200 bg-gray-50" : isInEditMode && isChanged ? "border-amber-300 bg-amber-50/30" : "border-gray-200"}`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-violet-600 font-bold mr-2">
                      {index + 1}.
                    </span>
                    <span className="flex-1">{resposta.competencia_nome}</span>
                    {isInEditMode && isChanged && (
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
                      disabled={isLocked}
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
                      disabled={isLocked}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {/* Secao 7 - Competencias Estrategicas (apenas gestor) */}
      {tipoInventario === "gestor" &&
        mostrarCompetencias &&
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
                    Avalie o nível de desenvolvimento do gestor em cada
                    competência estratégica listada abaixo.
                  </p>
                  <p>Utilize a seguinte escala:</p>
                  <EscalaLegenda items={ESCALA_ESTRATEGICA} />
                </div>
              </div>
            </div>

            {form.respostas_estrategicas.map((resposta, index) => {
              const isInEditMode =
                isEditMode ||
                avaliacaoExistente?.status === "atualizacao_requisitada";
              const isChanged = isCompChanged(
                resposta.competencia_nome,
                resposta.competencia_descricao,
              );
              const isLocked = isInEditMode && !isChanged;
              return (
                <Card
                  key={`estr-${index}`}
                  className={`border shadow-sm ${isLocked ? "border-gray-200 bg-gray-50" : isInEditMode && isChanged ? "border-amber-300 bg-amber-50/30" : "border-gray-200"}`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-blue-600 font-bold mr-2">
                        {index + 1}.
                      </span>
                      <span className="flex-1">
                        {resposta.competencia_nome}
                      </span>
                      {isInEditMode && isChanged && (
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
                    <div>
                      <Label>
                        Nível de desenvolvimento{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <EscalaRadioGroup
                        items={ESCALA_ESTRATEGICA}
                        name={`nota-estr-${index}`}
                        value={resposta.nota}
                        onChange={(v) =>
                          updateRespostaEstrategica(index, "nota", v)
                        }
                        disabled={isLocked}
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
                        disabled={isLocked}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}

      {/* Secao 8 - Competencias Gerenciais (apenas gestor) */}
      {tipoInventario === "gestor" &&
        mostrarCompetencias &&
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
                    Avalie o nível de desenvolvimento do gestor em cada
                    competência gerencial listada abaixo.
                  </p>
                  <p>Utilize a seguinte escala:</p>
                  <EscalaLegenda items={ESCALA_GERENCIAL} />
                </div>
              </div>
            </div>

            {form.respostas_gerenciais.map((resposta, index) => {
              const isInEditMode =
                isEditMode ||
                avaliacaoExistente?.status === "atualizacao_requisitada";
              const isChanged = isCompChanged(
                resposta.competencia_nome,
                resposta.competencia_descricao,
              );
              const isLocked = isInEditMode && !isChanged;
              return (
                <Card
                  key={`ger-${index}`}
                  className={`border shadow-sm ${isLocked ? "border-gray-200 bg-gray-50" : isInEditMode && isChanged ? "border-amber-300 bg-amber-50/30" : "border-gray-200"}`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-rose-600 font-bold mr-2">
                        {index + 1}.
                      </span>
                      <span className="flex-1">
                        {resposta.competencia_nome}
                      </span>
                      {isInEditMode && isChanged && (
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
                    <div>
                      <Label>
                        Nível de desenvolvimento{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <EscalaRadioGroup
                        items={ESCALA_GERENCIAL}
                        name={`nota-ger-${index}`}
                        value={resposta.nota}
                        onChange={(v) =>
                          updateRespostaGerencial(index, "nota", v)
                        }
                        disabled={isLocked}
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
                        disabled={isLocked}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}

      {/* Botao Enviar */}
      {mostrarCompetencias && form.respostas.length > 0 && (
        <div className="flex justify-end pb-6">
          <Button
            onClick={handleSubmit}
            disabled={saving || jaAvaliado}
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
                Enviar avaliação do gestor
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
