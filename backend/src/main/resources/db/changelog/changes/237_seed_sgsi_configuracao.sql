-- liquibase formatted sql

-- changeset kaizen:237_seed_sgsi_configuracao splitStatements:false
-- Seed PARÂMETRO: 10 configurações do SGSI (o NSI pode ajustar). Origem: SGSI/10_configuracao.sql.

INSERT INTO sgsi_configuracao (chave,valor,descricao) VALUES
('ancora.padrao','"2026-07-01"'::jsonb,'Data-base (M0) padrão dos planos 5W2H quando o instrumento não tem âncora própria.'),
('alerta.janela_dias','15'::jsonb,'Antecedência, em dias, para alerta de prazo próximo.'),
('stepup.ativo','true'::jsonb,'Ativa a exigência de autenticação reforçada para instrumentos restritos.'),
('stepup.instrumentos','["PPINC", "PGCRC", "PIILC"]'::jsonb,'Instrumentos VI, VII e VIII — circulação restrita.'),
('stepup.validade_min','15'::jsonb,'Validade, em minutos, da autenticação reforçada por instrumento e sessão.'),
('emissao.tamanho_max_bytes','8388608'::jsonb,'Tamanho máximo da digitalização anexada a uma emissão (8 MB).'),
('emissao.mime_permitidos','["application/pdf", "image/png", "image/jpeg", "image/tiff"]'::jsonb,'Tipos aceitos na digitalização.'),
('risco.limiar_alto','45'::jsonb,'IRS a partir do qual o risco é classificado como Alto.'),
('risco.limiar_critico','81'::jsonb,'IRS a partir do qual o risco é classificado como Crítico.'),
('risco.limiar_moderado','21'::jsonb,'IRS a partir do qual o risco é classificado como Moderado.')
ON CONFLICT (chave) DO NOTHING;
