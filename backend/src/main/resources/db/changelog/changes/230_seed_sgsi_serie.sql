-- liquibase formatted sql

-- changeset kaizen:230_seed_sgsi_serie splitStatements:false
-- Seed PARÂMETRO: 16 séries de numeração (o NSI pode ajustar). Origem: SGSI/06_serie.sql.

INSERT INTO sgsi_serie (codigo,nome,prefixo,mascara,digitos,reinicia,orgao) VALUES
('DEC','Decreto Judiciário','DEC','{PFX}-{SEQ}/{ANO}',4,'ANO','TJGO'),
('PORT','Portaria','PORT','{PFX}-{SEQ}/{ANO}',4,'ANO','TJGO'),
('ITO','Instrução Técnica Operacional','ITO','{PFX}-{SEQ}/{ANO}',3,'ANO','NSI/DITI'),
('TERMO','Termo (custódia, sigilo, risco, descarte)','TRM','{PFX}-{SEQ}/{ANO}',4,'ANO','NSI'),
('TCI','Termo de Classificação da Informação','TCI','{PFX}-{SEQ}/{ANO}',4,'ANO','CPADS'),
('RIPD','Relatório de Impacto à Proteção de Dados','RIPD','{PFX}-{SEQ}/{ANO}',3,'ANO','CGPD/DPO'),
('ATA','Ata de deliberação/homologação','ATA','{PFX}-{SEQ}/{ANO}',3,'ANO','CGSI'),
('PLANO','Plano institucional','PLN','{PFX}-{SEQ}/{ANO}',3,'ANO','NSI'),
('INV','Inventário / Catálogo','INV','{PFX}-{SEQ}/{ANO}',3,'ANO','DITI'),
('FLUXO','Fluxo / processo instituído','FLX','{PFX}-{SEQ}/{ANO}',3,'ANO','NSI'),
('CHK','Checklist / matriz','CHK','{PFX}-{SEQ}/{ANO}',3,'ANO','NSI'),
('PROC','Procedimento operacional','PROC','{PFX}-{SEQ}/{ANO}',3,'ANO','DITI/NSI'),
('EVID','Evidência / registro de conformidade','EVD','{PFX}-{SEQ}/{ANO}',4,'ANO','NSI'),
('IND','Indicadores / painel','IND','{PFX}-{SEQ}/{ANO}',3,'ANO','NSI'),
('REL','Relatório de prestação de contas','REL','{PFX}-{SEQ}/{ANO}',4,'ANO','NSI'),
('CIRC','Circular / comunicação institucional','CIR','{PFX}-{SEQ}/{ANO}',3,'ANO','NSI')
ON CONFLICT (codigo) DO NOTHING;
