import { competenciasGestorApi } from "@/services/competenciasGestorApi";
import { EditoresMatriz } from "./EditoresMatriz";

/**
 * Editores da Matriz de Competências do Gestor.
 *
 * O diretor da área associa usuários que passam a PREENCHER a matriz do gestor de todas as
 * unidades daquela área — inclusive as criadas depois, já que o vínculo é por área e não por
 * unidade. O editor não valida: a matriz que ele preenche não gera camada de autor e sobe direto
 * para a diretoria e a validação final.
 */
export function EditoresMatrizGestor() {
  return (
    <EditoresMatriz
      titulo="Editores da Matriz do Gestor"
      descricao="O editor preenche a Matriz de Competências do Gestor de todas as unidades da área."
      rotuloEscopo="Área"
      placeholderEscopo="Selecione a área"
      mensagemSemEscopo="Você não dirige nenhuma macroárea, então não há editores a administrar."
      aviso={
        <>
          O editor <strong>apenas preenche e salva</strong>. A matriz preenchida
          por ele não passa pela camada do autor: vai direto para a validação da
          diretoria e depois para a validação final.
        </>
      }
      carregarEscopos={() => competenciasGestorApi.getAreasQueDirijo()}
      carregarEditores={(areaId) => competenciasGestorApi.getEditores(areaId)}
      associarEditor={(areaId, userId) =>
        competenciasGestorApi.addEditor(areaId, userId)
      }
      removerEditor={(editor, areaId) =>
        competenciasGestorApi.removeEditor(editor.id, areaId)
      }
    />
  );
}
