import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../../services/apiClient';

interface CardGestorProps {
  gestor: {
    id: number;
    nome_area: string;
    nome_exibicao?: string | null;
    nome_gestor: string;
    nome_cargo: string;
    foto_gestor: string | null;
    cor_barra: string | null;
    linha_organograma: number;
  };
  onRefresh: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDragging?: boolean;
  canDrag?: boolean;
}

const CardGestor: React.FC<CardGestorProps> = ({ 
  gestor, 
  onEdit, 
  onDelete, 
  isDragging = false,
  canDrag = false 
}) => {
  const { 
    id,
    nome_area, 
    nome_exibicao,
    nome_gestor, 
    nome_cargo, 
    foto_gestor, 
    linha_organograma 
  } = gestor;

  // Usar nome_exibicao se existir, senão usar nome_area
  const nomeExibido = nome_exibicao?.trim() || nome_area;

  // URL da foto - usar API_URL ou fallback para avatar
  const getAvatarUrl = () => {
    if (foto_gestor) {
      // Se a foto já é uma URL completa (http/https), usar diretamente
      if (foto_gestor.startsWith('http')) {
        return foto_gestor;
      }
      // Senão, adicionar base URL
      return `${API_BASE_URL}${foto_gestor}`;
    }
    // Fallback para avatar gerado
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(nome_gestor)}&background=1976D2&color=fff&size=400&bold=true`;
  };

  const avatarUrl = getAvatarUrl();

  // Classes do card baseadas no nível
  const cardClasses = [
    'card-gestor',
    `card-gestor-linha-${linha_organograma}`,
    linha_organograma === 1 ? 'card-gestor-diretoria' : '',
    isDragging ? 'card-gestor-dragging' : ''
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={cardClasses}
      id={`card-gestor-${id}`}
      data-gestor-id={id}
    >
      {/* Botões de ação (aparecem no hover) */}
      {(onEdit || onDelete) && (
        <div className="card-gestor-actions">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="card-gestor-btn card-gestor-btn-edit"
              title="Editar"
            >
              <Edit2 className="w-3 h-3 text-blue-600" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="card-gestor-btn card-gestor-btn-delete"
              title="Excluir"
            >
              <Trash2 className="w-3 h-3 text-red-600" />
            </button>
          )}
        </div>
      )}

      {/* FOTO CIRCULAR - ESQUERDA */}
      <div className="card-gestor-foto-container">
        <div className="card-gestor-foto-circular">
          <img 
            src={avatarUrl}
            alt={nome_gestor}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nome_gestor)}&background=1976D2&color=fff&size=200&bold=true`;
            }}
          />
        </div>
      </div>

      {/* INFORMAÇÕES - DIREITA */}
      <div className="card-gestor-info-container">
        {/* Barra de área colorida - topo */}
        <div className="card-gestor-barra-area" title={nome_area}>
          {nomeExibido}
        </div>

        {/* Texto: Nome e Cargo - abaixo da barra */}
        <div className="card-gestor-info-texto">
          <div className="card-gestor-nome" title={nome_gestor}>
            {nome_gestor}
          </div>
          <div className="card-gestor-cargo" title={nome_cargo}>
            {nome_cargo}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardGestor;
