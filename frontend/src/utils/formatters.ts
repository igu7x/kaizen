/**
 * Extrai e formata o rótulo concatenado de Área e Unidade de um objeto.
 * O objeto pode ser um Ifo, Contract, ou qualquer objeto que implemente essas propriedades base.
 */
export const getAreaLabel = (item: {
  cadastrosAreasId?: number | null;
  cadastroAreaId?: number | null; // From Contract
  areaSigla?: string | null;
  areaNome?: string | null;
  cadastrosUnidadesId?: number | null;
  cadastroUnidadeId?: number | null; // From Contract
  unidadeSigla?: string | null;
  unidadeNome?: string | null;
}) => {
  const parts = [];
  
  if (item.cadastrosAreasId || item.cadastroAreaId || item.areaSigla || item.areaNome) {
    parts.push(item.areaSigla ? item.areaSigla : (item.areaNome || "Área"));
  }
  
  if (item.cadastrosUnidadesId || item.cadastroUnidadeId || item.unidadeSigla || item.unidadeNome) {
    parts.push(item.unidadeSigla ? item.unidadeSigla : (item.unidadeNome || "Unidade"));
  }
  
  return parts.length > 0 ? parts.join(" / ") : "-";
};
