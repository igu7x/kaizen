import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDirectorate } from "@/contexts/DirectorateContext";
import { KanbanBoard } from "./KanbanBoard";
import { gestaoEstrategicaApi } from "@/services/gestaoEstrategicaApi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type {
  PlanoPrograma,
  KrProjeto,
  GestaoTarefa,
  GestaoTarefaProgresso,
} from "@/types";
import { DropResult } from "react-beautiful-dnd";

interface TarefaComProjeto extends GestaoTarefa {
  plano_nome?: string;
}

interface EstatisticasProjeto {
  totalTarefas: number;
  aFazer: number;
  fazendo: number;
  feito: number;
  progresso: number;
}

export function SprintAtualNovo() {
  const { user } = useAuth();
  const { selectedAreaId, selectedArea } = useDirectorate();
  const { toast } = useToast();

  // Estados
  const [planos, setPlanos] = useState<PlanoPrograma[]>([]);
  const [projetos, setProjetos] = useState<KrProjeto[]>([]);
  const [tarefasSprint, setTarefasSprint] = useState<TarefaComProjeto[]>([]);
  const [entregas, setEntregas] = useState<any[]>([]); // Entregas do projeto selecionado
  const [loading, setLoading] = useState(true);

  // Filtros
  const [planoSelecionado, setPlanoSelecionado] = useState<string>("");
  const [projetoSelecionado, setProjetoSelecionado] = useState<string>("");

  const canEdit = user?.role === "ADMIN";

  // Carregar dados
  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);

      // Carregar planos da diretoria
      const planosData =
        await gestaoEstrategicaApi.getPlanos(selectedAreaId);
      setPlanos(planosData);

      // Carregar todos os projetos
      const projetosData = await gestaoEstrategicaApi.getProjetos();
      setProjetos(projetosData);

      // Carregar todas as tarefas e filtrar as que estão na Sprint Atual
      const todasTarefas = await gestaoEstrategicaApi.getTarefas();
      const tarefasNaSprint = todasTarefas.filter(
        (t) => t.status === "sprint_atual",
      );

      // Adicionar informação do projeto/plano
      const tarefasComInfo: TarefaComProjeto[] = tarefasNaSprint.map(
        (tarefa) => {
          const projeto = projetosData.find((p) => p.id === tarefa.projeto_id);
          const plano = planosData.find((pl) => pl.id === projeto?.plano_id);
          return {
            ...tarefa,
            projeto_nome: projeto?.nome,
            plano_nome: plano?.nome,
          };
        },
      );

      setTarefasSprint(tarefasComInfo);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoading(false);
    }
  }, [selectedAreaId, toast]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Carregar entregas quando um projeto for selecionado
  useEffect(() => {
    const carregarEntregas = async () => {
      if (!projetoSelecionado) {
        setEntregas([]);
        return;
      }

      try {
        const projeto = projetos.find(
          (p) => p.id === parseInt(projetoSelecionado),
        );

        if (projeto?.instrumento_id) {
          const { cadastrosProjetosApi } =
            await import("@/services/cadastrosProjetosApi");
          const projetoDetalhes = await cadastrosProjetosApi.getProjetoById(
            projeto.instrumento_id,
          );

          setEntregas(projetoDetalhes.entregas || []);
        } else {
          setEntregas([]);
        }
      } catch (error) {
        setEntregas([]);
      }
    };

    carregarEntregas();
  }, [projetoSelecionado, projetos]);

  // Filtrar projetos pelo plano selecionado
  const projetosFiltrados = useMemo(() => {
    if (!planoSelecionado) return [];
    return projetos.filter((p) => p.plano_id === parseInt(planoSelecionado));
  }, [projetos, planoSelecionado]);

  // Filtrar tarefas
  const tarefasFiltradas = useMemo(() => {
    // Se não selecionou projeto, não mostra tarefas
    if (!projetoSelecionado) return [];

    return tarefasSprint.filter(
      (t) => t.projeto_id === parseInt(projetoSelecionado),
    );
  }, [tarefasSprint, projetoSelecionado]);

  // Calcular estatísticas do projeto selecionado
  const estatisticasProjeto = useMemo((): EstatisticasProjeto => {
    const tarefas = tarefasFiltradas;
    const totalTarefas = tarefas.length;
    const aFazer = tarefas.filter((t) => t.progresso === "a_fazer").length;
    const fazendo = tarefas.filter((t) => t.progresso === "fazendo").length;
    const feito = tarefas.filter((t) => t.progresso === "feito").length;

    // Calcular progresso baseado em ENTREGAS ao invés de tarefas
    const totalEntregas = entregas.length;
    const entregasConcluidas = entregas.filter(
      (e) => e.status === "concluida",
    ).length;
    const progresso =
      totalEntregas > 0
        ? Math.round((entregasConcluidas / totalEntregas) * 100)
        : 0;

    return { totalTarefas, aFazer, fazendo, feito, progresso };
  }, [tarefasFiltradas, entregas]);

  // Mapear tarefa para item do Kanban
  const mapTarefaToKanbanItem = (tarefa: TarefaComProjeto) => ({
    id: String(tarefa.id),
    title: tarefa.nome,
    description: tarefa.projeto_nome || "",
    badge: tarefa.plano_nome,
  });

  // Colunas do Kanban
  const kanbanColumns = useMemo(
    () => [
      {
        id: "a_fazer" as GestaoTarefaProgresso,
        title: "A Fazer",
        items: tarefasFiltradas
          .filter((t) => t.progresso === "a_fazer")
          .map(mapTarefaToKanbanItem),
      },
      {
        id: "fazendo" as GestaoTarefaProgresso,
        title: "Fazendo",
        items: tarefasFiltradas
          .filter((t) => t.progresso === "fazendo")
          .map(mapTarefaToKanbanItem),
      },
      {
        id: "feito" as GestaoTarefaProgresso,
        title: "Feito",
        items: tarefasFiltradas
          .filter((t) => t.progresso === "feito")
          .map(mapTarefaToKanbanItem),
      },
    ],
    [tarefasFiltradas],
  );

  // Handler para drag and drop
  const handleDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;

    if (!destination || !canEdit) return;

    const novoProgresso = destination.droppableId as GestaoTarefaProgresso;
    const tarefaId = parseInt(draggableId);

    try {
      await gestaoEstrategicaApi.updateTarefa(tarefaId, {
        progresso: novoProgresso,
      });

      // Atualizar localmente para feedback imediato
      setTarefasSprint((prev) =>
        prev.map((t) =>
          t.id === tarefaId ? { ...t, progresso: novoProgresso } : t,
        ),
      );
    } catch (error) {
      // Recarregar para reverter
      await carregarDados();
    }
  };

  // Resetar projeto quando plano muda
  useEffect(() => {
    setProjetoSelecionado("");
  }, [planoSelecionado]);

  // Painel de progresso do projeto (acima do Kanban)
  const renderPainelProgresso = () => {
    if (!projetoSelecionado || tarefasFiltradas.length === 0) return null;

    const stats = estatisticasProjeto;
    const projetoNome =
      projetos.find((p) => p.id === parseInt(projetoSelecionado))?.nome || "";

    return (
      <div className="bg-[#3A5A6F] rounded-lg shadow-lg p-4 mb-4">
        <div className="flex items-center justify-between gap-6">
          {/* Nome do Projeto */}
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-sm">KR/Projeto:</span>
            <span className="text-white font-semibold">{projetoNome}</span>
          </div>

          {/* Total de Tarefas */}
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">Total de tarefas:</span>
            <span className="text-lg font-bold text-blue-400">
              {stats.totalTarefas}
            </span>
          </div>

          {/* Barra de Progresso */}
          <div className="flex items-center gap-3 flex-1 max-w-xs">
            <span className="text-white/60 text-sm">Progresso:</span>
            <div className="flex-1 bg-[#1E4050] rounded-full h-3">
              <div
                className="bg-green-400 h-3 rounded-full transition-all duration-300"
                style={{ width: `${stats.progresso}%` }}
              />
            </div>
            <span className="text-lg font-bold text-white min-w-[50px] text-right">
              {stats.progresso}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-2">
          <Label className="text-white text-sm">Plano/Programa</Label>
          <Select value={planoSelecionado} onValueChange={setPlanoSelecionado}>
            <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Selecione um plano" />
            </SelectTrigger>
            <SelectContent>
              {planos.map((plano) => (
                <SelectItem key={plano.id} value={String(plano.id)}>
                  {plano.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-white text-sm">KR/Projeto</Label>
          <Select
            value={projetoSelecionado}
            onValueChange={setProjetoSelecionado}
          >
            <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {projetosFiltrados.map((projeto) => (
                <SelectItem key={projeto.id} value={String(projeto.id)}>
                  {projeto.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="text-center py-12 text-white/60">Carregando...</div>
      ) : !planoSelecionado ? (
        <div className="text-center py-12">
          <p className="text-white/60 mb-2">Selecione um Plano/Programa</p>
          <p className="text-white/40 text-sm">
            Escolha um plano para visualizar os projetos disponíveis
          </p>
        </div>
      ) : !projetoSelecionado ? (
        <div className="text-center py-12">
          <p className="text-white/60 mb-2">Selecione um KR/Projeto</p>
          <p className="text-white/40 text-sm">
            Escolha um projeto para visualizar as tarefas na Sprint Atual
          </p>
        </div>
      ) : tarefasFiltradas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/60 mb-2">Nenhuma tarefa na Sprint Atual</p>
          <p className="text-white/40 text-sm">
            Para adicionar tarefas à Sprint, vá em "Escritório de Projetos" e
            altere o status para "Sprint Atual"
          </p>
        </div>
      ) : (
        <>
          {/* Painel de Progresso acima do Kanban */}
          {renderPainelProgresso()}

          <KanbanBoard
            title="SPRINT ATUAL"
            columns={kanbanColumns}
            onDragEnd={handleDragEnd}
            canEdit={canEdit}
          />
        </>
      )}
    </div>
  );
}
