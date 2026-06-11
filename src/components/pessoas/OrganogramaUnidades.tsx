import React, { useState } from "react";
import {
  Building2,
  Loader2,
  User,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Unidade } from "@/services/areasApi";
import "./organograma.css";

interface OrganogramaUnidadesProps {
  unidades: Unidade[];
  areaNome: string;
  // Sigla da macroárea — usada como fallback adicional pra identificar a unidade-raiz
  // quando a unidade cadastrada usa só a sigla ("GEJUT") em vez do nome completo.
  areaSigla?: string;
  loading?: boolean;
  onUnidadeClick: (unidade: Unidade) => void;
  onUnidadeReorder?: (unidadeId: number, newOrdem: number) => Promise<void>;
  selectedUnidadeId?: number | null;
  canEdit?: boolean;
  // Quando true, força os filhos diretos do raiz a renderizarem no layout vertical
  // (estilo "Unidades sem vínculo hierárquico"), mesmo padrão usado pra órfãos.
  forceVerticalLayout?: boolean;
}

interface TreeNode {
  unidade: Unidade;
  children: TreeNode[];
}

function buildTree(
  unidades: Unidade[],
  areaNome: string,
  areaSigla?: string,
): { root: TreeNode | null; orfaos: TreeNode[] } {
  if (unidades.length === 0) return { root: null, orfaos: [] };

  const childrenMap = new Map<number, Unidade[]>();
  unidades.forEach((u) => {
    const pid = u.unidade_superior_id;
    if (pid != null) {
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(u);
    }
  });
  childrenMap.forEach((arr) =>
    arr.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)),
  );

  const buildSubtree = (u: Unidade): TreeNode => ({
    unidade: u,
    children: (childrenMap.get(u.id) || []).map(buildSubtree),
  });

  // Identificação da raiz por nome (preferencial) e, como fallback, por sigla —
  // alguns cadastros usam só a sigla ("GEJUT", "DG", "SGP") como nome da unidade-raiz.
  const norm = (s?: string) => (s || "").toLowerCase().trim();
  const nomeAlvo = norm(areaNome);
  const siglaAlvo = norm(areaSigla);
  const raizPreferida =
    unidades.find((u) => norm(u.nome) === nomeAlvo) ||
    (siglaAlvo ? unidades.find((u) => norm(u.nome) === siglaAlvo) : undefined);

  const semSuperior = unidades.filter((u) => !u.unidade_superior_id);
  const raiz = raizPreferida || semSuperior[0];

  if (!raiz) {
    return { root: null, orfaos: semSuperior.map(buildSubtree) };
  }

  const root = buildSubtree(raiz);
  const orfaos = semSuperior.filter((u) => u.id !== raiz.id).map(buildSubtree);
  return { root, orfaos };
}

const OrganogramaUnidades: React.FC<OrganogramaUnidadesProps> = ({
  unidades,
  areaNome,
  areaSigla,
  loading = false,
  onUnidadeClick,
  onUnidadeReorder,
  selectedUnidadeId,
  canEdit = false,
  forceVerticalLayout = false,
}) => {
  const [draggedUnidade, setDraggedUnidade] = useState<Unidade | null>(null);
  const [dragOverUnidade, setDragOverUnidade] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggleCollapse = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, unidade: Unidade) => {
    if (!canEdit || !onUnidadeReorder) return;
    setDraggedUnidade(unidade);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", unidade.id.toString());
  };
  const handleDragEnd = () => {
    setDraggedUnidade(null);
    setDragOverUnidade(null);
  };
  const handleDragOver = (e: React.DragEvent, unidade: Unidade) => {
    e.preventDefault();
    if (!draggedUnidade || draggedUnidade.id === unidade.id) return;
    if (draggedUnidade.unidade_superior_id !== unidade.unidade_superior_id)
      return;
    e.dataTransfer.dropEffect = "move";
    setDragOverUnidade(unidade.id);
  };
  const handleDragLeave = () => setDragOverUnidade(null);
  const handleDrop = async (e: React.DragEvent, target: Unidade) => {
    e.preventDefault();
    if (!draggedUnidade || !onUnidadeReorder) return;
    if (draggedUnidade.id === target.id) return;
    if (draggedUnidade.unidade_superior_id !== target.unidade_superior_id)
      return;
    try {
      await onUnidadeReorder(draggedUnidade.id, target.ordem || 0);
    } catch (err) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setDraggedUnidade(null);
      setDragOverUnidade(null);
    }
  };

  if (loading) {
    return (
      <div className="organograma-container flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }
  if (unidades.length === 0) {
    return (
      <div className="organograma-container flex flex-col items-center justify-center py-12 text-gray-500">
        <Building2 className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-lg font-medium">Nenhuma unidade cadastrada</p>
        <p className="text-sm text-gray-400">
          Cadastre unidades em Cadastros &rarr; &Aacute;reas &rarr; Unidades
        </p>
      </div>
    );
  }

  const { root, orfaos } = buildTree(unidades, areaNome, areaSigla);
  const rootCollapsed = root ? collapsed.has(root.unidade.id) : false;
  const rootHasContent = root
    ? root.children.length > 0 || orfaos.length > 0
    : false;

  // Card simples e elegante. Ícone, nome e responsável.
  // Cor da barra superior por nível.
  const Card = ({
    unidade,
    depth,
    hasChildren,
    isCollapsed,
    onToggle,
  }: {
    unidade: Unidade;
    depth: number;
    hasChildren: boolean;
    isCollapsed: boolean;
    onToggle?: () => void;
  }) => {
    const isDragging = draggedUnidade?.id === unidade.id;
    const isDragOver = dragOverUnidade === unidade.id;
    const canDrag = canEdit && !!onUnidadeReorder;
    const isSelected = selectedUnidadeId === unidade.id;

    const barColors = [
      "bg-slate-700", // depth 0 (root)
      "bg-blue-600", // depth 1
      "bg-blue-500", // depth 2
      "bg-blue-400", // depth 3
      "bg-slate-400", // depth 4+
    ];
    const bar = barColors[Math.min(depth, barColors.length - 1)];

    return (
      <div
        className={`
          tree-card group relative bg-white rounded-lg shadow-sm border-2
          transition-all duration-150 overflow-hidden w-full flex
          ${isDragging ? "opacity-50" : ""}
          ${isDragOver ? "border-blue-400 bg-blue-50" : ""}
          ${!isDragging && !isDragOver ? "hover:shadow-md hover:border-blue-300" : ""}
          ${isSelected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"}
        `}
      >
        <div
          className={`w-1.5 ${isSelected ? "bg-blue-500" : bar} flex-shrink-0`}
        />
        <button
          onClick={() => onUnidadeClick(unidade)}
          draggable={canDrag}
          onDragStart={(e) => handleDragStart(e, unidade)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, unidade)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, unidade)}
          className={`flex-1 text-left p-2.5 min-w-0 ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
        >
          <div className="flex items-start gap-2">
            <div
              className={`p-1.5 rounded shrink-0 ${isSelected ? "bg-blue-100" : "bg-gray-100 group-hover:bg-blue-50"}`}
            >
              <Building2
                className={`h-3.5 w-3.5 ${isSelected ? "text-blue-600" : "text-gray-500 group-hover:text-blue-500"}`}
              />
            </div>
            <h4
              className={`flex-1 min-w-0 text-xs font-semibold leading-tight line-clamp-2 ${isSelected ? "text-blue-700" : "text-gray-800"}`}
            >
              {unidade.nome}
            </h4>
          </div>
          {unidade.responsavel && (
            <div className="flex items-center gap-1 mt-1.5 pl-1">
              <User className="h-2.5 w-2.5 text-gray-400 shrink-0" />
              <span className="text-[10px] text-gray-500 truncate">
                {unidade.responsavel}
              </span>
            </div>
          )}
        </button>
        {hasChildren && onToggle && (
          <button
            onClick={onToggle}
            className="px-2 hover:bg-gray-100 transition-colors flex items-center justify-center text-gray-400 hover:text-gray-600 border-l border-gray-100"
            title={isCollapsed ? "Expandir" : "Recolher"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    );
  };

  // Renderiza a árvore. Profundidade 0 (root) e profundidade 1 (filhos diretos) usam
  // layout horizontal (org chart clássico). Profundidades >= 2 usam layout vertical
  // indentado — mais legível pra subárvores profundas e zero risco dos conectores
  // bugarem com gradiente de fundo.
  const renderNode = (
    node: TreeNode,
    depth: number,
    useHorizontal: boolean,
  ): React.ReactElement => {
    const { unidade, children } = node;
    const hasChildren = children.length > 0;
    const isCollapsed = collapsed.has(unidade.id);
    const showChildren = hasChildren && !isCollapsed;

    // O próximo nível é horizontal só se o atual também for E houver no máximo 1 filho
    // por filho (para evitar cruzamento de linhas em níveis profundos).
    // A regra simples: depth 0 → horizontal; depth >= 1 → vertical.
    const nextHorizontal = depth === 0;

    return (
      <div className="tree-subtree" key={unidade.id}>
        <div className="tree-card-anchor">
          <Card
            unidade={unidade}
            depth={depth}
            hasChildren={hasChildren}
            isCollapsed={isCollapsed}
            onToggle={
              hasChildren ? () => toggleCollapse(unidade.id) : undefined
            }
          />
        </div>

        {showChildren &&
          (useHorizontal && children.length > 0 ? (
            <>
              <div className="tree-connector-down" />
              <div
                className="tree-children-h"
                data-count={children.length}
                style={{ ["--n" as any]: children.length }}
              >
                {children.map((child) => (
                  <div className="tree-child-cell" key={child.unidade.id}>
                    {renderNode(child, depth + 1, nextHorizontal)}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="tree-children-v">
              {children.map((child) => (
                <div className="tree-child-row" key={child.unidade.id}>
                  {renderNode(child, depth + 1, false)}
                </div>
              ))}
            </div>
          ))}
      </div>
    );
  };

  return (
    <div
      className="organograma-container bg-white rounded-xl border border-slate-200 w-full"
      style={{ maxHeight: "78vh", overflow: "auto" }}
    >
      <div className="sticky top-0 z-10 bg-white px-6 pt-5 pb-3 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-800">
          Organograma — {areaNome}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {unidades.length} unidade(s)
        </p>
      </div>

      <div className="px-6 py-8 flex flex-col items-center">
        {forceVerticalLayout && (root || orfaos.length > 0) ? (
          // Modo "Unidades subordinadas a mim": cada unidade que o usuário gere
          // é uma ÁRVORE INDEPENDENTE, sem conectores entre elas.
          <div
            className="tree-canvas"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "32px",
              alignItems: "center",
            }}
          >
            {(root ? [root, ...orfaos] : orfaos).map((topNode) => {
              const isTopCollapsed = collapsed.has(topNode.unidade.id);
              const topHasChildren = topNode.children.length > 0;
              return (
                <div className="tree-subtree" key={topNode.unidade.id}>
                  <div className="tree-card-anchor">
                    <Card
                      unidade={topNode.unidade}
                      depth={0}
                      hasChildren={topHasChildren}
                      isCollapsed={isTopCollapsed}
                      onToggle={
                        topHasChildren
                          ? () => toggleCollapse(topNode.unidade.id)
                          : undefined
                      }
                    />
                  </div>
                  {!isTopCollapsed && topHasChildren && (
                    <>
                      <div className="tree-connector-down tree-connector-down--orfaos" />
                      <div className="tree-orfaos-block">
                        <div className="tree-children-v">
                          {topNode.children.map((child) => (
                            <div
                              className="tree-child-row"
                              key={child.unidade.id}
                            >
                              {renderNode(child, 1, false)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : root ? (
          <div className="tree-canvas">
            <div className="tree-subtree">
              <div className="tree-card-anchor">
                <Card
                  unidade={root.unidade}
                  depth={0}
                  hasChildren={rootHasContent}
                  isCollapsed={rootCollapsed}
                  onToggle={
                    rootHasContent
                      ? () => toggleCollapse(root.unidade.id)
                      : undefined
                  }
                />
              </div>

              {!rootCollapsed && root.children.length > 0 && (
                <>
                  <div className="tree-connector-down" />
                  <div
                    className="tree-children-h"
                    data-count={root.children.length}
                    style={{ ["--n" as any]: root.children.length }}
                  >
                    {root.children.map((child) => (
                      <div className="tree-child-cell" key={child.unidade.id}>
                        {renderNode(child, 1, false)}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!rootCollapsed && orfaos.length > 0 && (
                <>
                  <div className="tree-connector-down tree-connector-down--orfaos" />
                  <div className="tree-orfaos-block">
                    <div className="tree-children-v">
                      {orfaos.map((orfao) => (
                        <div className="tree-child-row" key={orfao.unidade.id}>
                          {renderNode(orfao, 1, false)}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : orfaos.length > 0 ? (
          <div className="w-full max-w-2xl">
            <div className="tree-children-v">
              {orfaos.map((orfao) => (
                <div className="tree-child-row" key={orfao.unidade.id}>
                  {renderNode(orfao, 1, false)}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default OrganogramaUnidades;
