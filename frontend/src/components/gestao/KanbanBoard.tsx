import { useState, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { BoardStatus } from "@/types";

interface KanbanItem {
  id: string;
  title: string;
  description?: string;
  badge?: string;
}

// Tipo genérico para suportar tanto BoardStatus quanto GestaoTarefaProgresso
type ColumnId = BoardStatus | "a_fazer" | "fazendo" | "feito";

interface KanbanBoardProps {
  title?: string;
  columns: {
    id: ColumnId;
    title: string;
    items: KanbanItem[];
  }[];
  onDragEnd: (result: DropResult) => void;
  onAdd?: (columnId: ColumnId) => void;
  onEdit?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
  canEdit?: boolean;
}

// Cores para cada coluna (suporta uppercase e lowercase)
const columnColors: Record<string, string> = {
  A_FAZER: "bg-gray-200",
  FAZENDO: "bg-yellow-100",
  FEITO: "bg-green-100",
  a_fazer: "bg-gray-200",
  fazendo: "bg-yellow-100",
  feito: "bg-green-100",
};

const columnHeaderColors: Record<string, string> = {
  A_FAZER: "bg-gray-400 text-gray-900",
  FAZENDO: "bg-yellow-400 text-gray-900",
  FEITO: "bg-green-500 text-white",
  a_fazer: "bg-gray-400 text-gray-900",
  fazendo: "bg-yellow-400 text-gray-900",
  feito: "bg-green-500 text-white",
};

interface KanbanCardProps {
  item: KanbanItem;
  index: number;
  canEdit: boolean;
  onEdit?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
}

function KanbanCard({
  item,
  index,
  canEdit,
  onEdit,
  onDelete,
}: KanbanCardProps) {
  const [showDescription, setShowDescription] = useState(false);

  // Handlers que param propagação para não interferir no drag
  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit?.(item.id);
    },
    [item.id, onEdit],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(item.id);
    },
    [item.id, onDelete],
  );

  const handleToggleDescription = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDescription((prev) => !prev);
  }, []);

  return (
    <Draggable draggableId={item.id} index={index} isDragDisabled={!canEdit}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          className={`
            bg-white rounded-lg border transition-shadow
            ${
              snapshot.isDragging
                ? "shadow-2xl border-blue-500 opacity-80"
                : "shadow border-gray-200 hover:shadow-md"
            }
            ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}
          `}
        >
          <div className="p-3">
            <div className="flex items-center gap-2">
              {/* Badge */}
              {item.badge && (
                <Badge
                  variant="outline"
                  className="shrink-0 text-xs font-semibold border-[#2d6a7f] text-[#2d6a7f]"
                >
                  {item.badge}
                </Badge>
              )}

              {/* Title */}
              <span
                className="flex-1 text-sm font-medium text-gray-700 truncate"
                title={item.title}
              >
                {item.title}
              </span>

              {/* Actions */}
              <div
                className="flex items-center gap-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleToggleDescription}
                  className="h-7 w-7 p-0 text-gray-500 hover:text-blue-600 cursor-pointer"
                  title={
                    showDescription ? "Ocultar descrição" : "Ver descrição"
                  }
                  type="button"
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>

                {canEdit && onEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEdit}
                    className="h-7 w-7 p-0 text-gray-500 hover:text-blue-600 cursor-pointer"
                    type="button"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canEdit && onDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDelete}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Description */}
            {showDescription && item.description && (
              <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                {item.description}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

export function KanbanBoard({
  title,
  columns,
  onDragEnd,
  onAdd,
  onEdit,
  onDelete,
  canEdit = false,
}: KanbanBoardProps) {
  return (
    <Card>
      {title && (
        <CardHeader className="bg-[#2d6a7f] text-white">
          <CardTitle className="text-lg font-bold">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xl:gap-5 2xl:gap-6">
            {columns.map((column) => (
              <div key={column.id} className="flex flex-col">
                {/* Header da Coluna */}
                <div
                  className={`flex items-center justify-between p-3 rounded-t-lg font-semibold ${columnHeaderColors[column.id]}`}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm lg:text-base">{column.title}</h3>
                    <Badge
                      variant="secondary"
                      className="bg-white/50 text-gray-900 font-bold"
                    >
                      {column.items.length}
                    </Badge>
                  </div>
                  {canEdit && onAdd && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onAdd(column.id)}
                      className="h-7 w-7 p-0 hover:bg-white/20"
                      title="Adicionar iniciativa"
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Área Droppable */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`
                        flex-1 min-h-[400px] p-3 rounded-b-lg space-y-2 transition-colors
                        ${
                          snapshot.isDraggingOver
                            ? "bg-blue-100 ring-2 ring-blue-400 ring-inset"
                            : columnColors[column.id]
                        }
                      `}
                    >
                      {column.items.map((item, index) => (
                        <KanbanCard
                          key={item.id}
                          item={item}
                          index={index}
                          canEdit={canEdit}
                          onEdit={onEdit}
                          onDelete={onDelete}
                        />
                      ))}
                      {provided.placeholder}

                      {/* Mensagem quando a coluna está vazia */}
                      {column.items.length === 0 &&
                        !snapshot.isDraggingOver && (
                          <div className="flex items-center justify-center h-32 text-gray-400 text-sm italic">
                            Nenhum item
                          </div>
                        )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </CardContent>
    </Card>
  );
}
