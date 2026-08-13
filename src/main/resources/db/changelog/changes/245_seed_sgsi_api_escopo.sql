-- liquibase formatted sql

-- changeset kaizen:245_seed_sgsi_api_escopo
-- Seed REFERÊNCIA: 13 escopos de API do SGSI. Origem: SGSI/09_api_escopo.sql.

INSERT INTO sgsi_api_escopo (codigo,descricao) VALUES
('docs:read','Consultar obrigações documentais e seu status'),
('docs:write','Criar e atualizar obrigações documentais'),
('emis:read','Consultar o livro de emissões e metadados dos documentos numerados'),
('emis:write','Emitir documento com numeração e anexar digitalização'),
('tasks:read','Consultar tarefas do plano 5W2H e percentuais de execução'),
('tasks:write','Atualizar status e percentual de execução das tarefas'),
('inds:read','Consultar indicadores e séries de medição'),
('inds:write','Registrar medições de indicadores'),
('risks:read','Consultar o inventário de riscos e o IRS'),
('alerts:write','Registrar alertas e eventos de prazo'),
('reports:read','Consultar relatórios emitidos'),
('audit:read','Consultar a trilha de auditoria'),
('restrito:read','Acessar conteúdo dos Instrumentos VI, VII e VIII (exige mTLS e aprovação do NSI)')
ON CONFLICT (codigo) DO NOTHING;
