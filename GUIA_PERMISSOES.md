# Guia de Implementação: Sistema de Permissões e Segurança do Kaizen

Este documento é o guia definitivo de permissões do sistema Kaizen. **Para futuros agentes (IAs) e desenvolvedores:** Leia atentamente para não confundir os contextos. O Kaizen possui múltiplas camadas de segurança, e a abordagem de "Permissões de Ação (Tags)" **NÃO DEVE** ser usada como a única forma de bloqueio do sistema.

Não polua a aplicação com tags desnecessárias. Utilize a ferramenta certa para cada nível de restrição.

---

## 1. As 4 Camadas de Permissão no Kaizen

### A. Permissões Gerais (Filtro de Conteúdo Visível e Multi-Tenancy)
As Permissões Gerais definem "o que" o usuário consegue enxergar dentro do sistema. 
- **Objetivo:** Filtragem de escopo de dados (ex: um usuário da Área X só vê processos e documentos gerados pela sua Área X) e Isolamento de Domínios (Multi-Tenant).
- **Como funciona:** O usuário recebe acessos a áreas e unidades através do seu próprio registro na tabela `users` (colunas `cadastros_areas_id` e `cadastros_unidades_id`). A partir do seu `cadastros_areas_id`, o sistema descobre a qual **Domínio** (ex: SGJT, CGJ) a área pertence. 
  - Se a área for definida como `is_domain_root` = true (Raiz do Domínio), o usuário consegue visualizar os dados de **todas as áreas** pertencentes ao mesmo domínio.
  - Se `is_domain_root` = false, o usuário visualiza apenas os dados restritos ao seu `cadastros_areas_id` (ou `cadastros_unidades_id`).
- **Quando usar:** Quando você precisar isolar o conteúdo de uma Unidade/Área/Domínio para que membros de outros locais não vejam, implementando os filtros (`WHERE cadastros_areas_id = ?` ou filtrando pelo `dominio`) nas consultas SQL do backend. A plataforma adota rigorosamente essa hierarquia em IDs numéricos (em oposição ao antigo uso de texto livre).

### B. Perfis (Roles)
Perfis (Roles) são os níveis hierárquicos de acesso base estruturais dos usuários.
- **Roles Comuns:** `Visualizador`, `Colaborador`, `Gestor`, `Administrador`.
- **Objetivo:** Liberar ou bloquear módulos inteiros, telas, ou ações genéricas de CRUD inerentes ao nível hierárquico.
- **Como funciona:** Os roles estão na tabela `users` (coluna `role`). No Frontend, eles geralmente decidem quais itens do menu principal (Sidebar) aparecem. No Backend, você pode usá-los para validar ações genéricas (ex: apenas Gestores podem aprovar férias na sua unidade).
- **Quando usar:** Para controle de acesso genérico e comportamental. Exemplo: "Somente Gestores podem inativar projetos". *Não crie e não use Tags de Ação para isso.*

### C. Tags Especiais do Sistema (Superadmin / Developer)
Existem colunas hardcoded na tabela `users` que representam os administradores globais do sistema.
- **Flags:** `is_superadmin` e `is_developer`.
- **Objetivo:** Acesso irrestrito total, ignorando qualquer bloqueio de Área, Unidade, Role ou Tag.
- **Como funciona:** Se `is_superadmin == true`, o frontend renderiza menus de "Painel Admin" globais e o backend libera rotas sensíveis de configuração global.
- **Quando usar:** Ao criar rotas ou telas que afetam TODO O SISTEMA (ex: criar uma nova Área no banco, gerenciar permissões base) e que apenas o suporte de TI ou a alta governança deve ter acesso.

### D. Permissões de Ação (Tags Granulares - `@TagAcao`)
As Permissões de Ação **SÃO A EXCEÇÃO**, e não a regra. Elas são micro-permissões granulares e cirúrgicas.
- **Objetivo:** Bloquear ações críticas e fluxos de negócio muito específicos que fogem à regra geral dos Perfis (Roles).
- **Como funciona:** Tabelas `tags_acoes` e `permissoes_acoes`. Um usuário comum recebe uma concessão especial, dentro do escopo da sua Unidade, para realizar apenas uma ação específica que sua Role normalmente não dita (ou para restringir algo que sua Role ditaria).
- **Quando usar:** Apenas para regras de negócio refinadas. Exemplo: "Consolidação DFD Etapa 3", "Assinar Relatório Final". Não use `@TagAcao` para esconder um menu genérico se isso puder ser resolvido por Roles.

---

## 2. Guia de Implementação: `@TagAcao` (Permissões de Ação)

*(Apenas se você decidiu que a restrição realmente precisa ser uma Permissão de Ação granular, siga este guia.)*

A validação ocorre via **Interceptor Spring (`PermissoesAcoesInterceptor`)**. Ele varre a Classe e o Método da API em busca da anotação `@TagAcao`. 

### Como Utilizar a Anotação `@TagAcao`

A anotação pode receber uma única tag ou uma lista de tags, a nível de **Classe** (Controller) e/ou **Método**. Se você colocar na Classe E no Método, o usuário deverá ter acesso às duas tags.

#### Exemplo A: Restrição Simples (Uma única tag)
```java
@PostMapping("/dfd/consolidar")
@TagAcao("CONSOLIDACAO_DFD_ETAPA_3") // Trava este botão/ação específica
public ResponseEntity<?> consolidarDfd() { ... }
```

#### Exemplo B: Múltiplas Tags (Lógica ANY vs ALL)
```java
// Precisa da Tag A *OU* Tag B
@DeleteMapping("/fechar-ciclo")
@TagAcao({"FECHAMENTO_LOTE", "AUDITORIA_ESPECIAL"}) // default é Logical.ANY
public ResponseEntity<?> fecharCiclo() { ... }

// Precisa da Tag A *E* Tag B
@PutMapping("/transferir")
@TagAcao(value = {"MODULO_BANCARIO", "AUTORIZACAO_ESPECIAL"}, logical = TagAcao.Logical.ALL)
public ResponseEntity<?> transferir() { ... }
```

---

## 3. Integração com o Frontend (React)

Para esconder menus genéricos, abas ou elementos no Frontend, **dependa primeiro da Role (`user.role`) e das flags de privilégio (`user.is_superadmin`)**. 

Se for renderizar um botão ou ação que está protegido por uma `@TagAcao` no backend, siga este fluxo:
1. O backend expõe as tags ativas do usuário na rota de perfil (ou seja, o Interceptor permite carregar suas tags em `user.tags_acesso`).
2. No Frontend, você checa a presença da tag antes de exibir o botão interativo:
   ```typescript
   if (user.tags_acesso.includes('CONSOLIDACAO_DFD_ETAPA_3')) {
       // Renderiza o botão "Consolidar DFD"
   }
   ```

---

**⚠️ AVISO FINAL PARA IAs/AGENTES:** 
Jamais crie `tags_acoes` como "CRIAR_USUARIO", "EDITAR_AREA" ou "VER_FINANCEIRO". Isso é estritamente papel da flag `is_superadmin` ou da `role = Administrador` / `role = Gestor`. Reserve o `@TagAcao` única e exclusivamente para regras de negócio específicas que precisem de uma delegação de poder granular.
