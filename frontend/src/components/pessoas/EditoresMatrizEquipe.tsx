import { competenciasGestorApi } from "@/services/competenciasGestorApi";
import { EditoresMatriz } from "./EditoresMatriz";

/**
 * Editores da Matriz de Competências da Equipe.
 *
 * O gestor da unidade associa usuários que passam a PREENCHER e SALVAR a matriz da equipe daquela
 * unidade. Diferente do editor da matriz do gestor, aqui a camada 1 continua existindo — e é do
 * próprio gestor: ele delega o preenchimento mas segue respondendo pelo que sai da unidade dele.
 */
export function EditoresMatrizEquipe() {
  return (
    <EditoresMatriz
      titulo="Editores da Matriz da Equipe"
      descricao="O editor preenche a Matriz de Competências da Equipe da unidade selecionada."
      rotuloEscopo="Unidade"
      placeholderEscopo="Selecione a unidade"
      mensagemSemEscopo="Você não é gestor de nenhuma unidade, então não há editores a administrar."
      aviso={
        <>
          O editor <strong>apenas preenche e salva</strong>. A validação da
          primeira camada continua sendo <strong>sua</strong>, como gestor da
          unidade, e depois seguem a diretoria e a validação final.
        </>
      }
      carregarEscopos={() => competenciasGestorApi.getUnidadesQueGerencio()}
      carregarEditores={(unidadeId) =>
        competenciasGestorApi.getEditoresEquipe(unidadeId)
      }
      associarEditor={(unidadeId, userId) =>
        competenciasGestorApi.addEditorEquipe(unidadeId, userId)
      }
      removerEditor={(editor, unidadeId) =>
        competenciasGestorApi.removeEditorEquipe(editor.user_id, unidadeId)
      }
    />
  );
}
