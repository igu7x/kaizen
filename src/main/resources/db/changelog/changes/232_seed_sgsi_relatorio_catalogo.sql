-- liquibase formatted sql

-- changeset kaizen:232_seed_sgsi_relatorio_catalogo splitStatements:false
-- Seed REAL: 21 modelos de relatório (17 obrigatórios + 4 sob demanda). Origem: SGSI/07_relatorio_catalogo.sql.

INSERT INTO sgsi_relatorio_catalogo (codigo,nome,obrigatorio,periodicidade,destinatario,base_normativa,instrumento_codigo,ordem) VALUES
('R01','Relatório de Maturidade em Segurança Cibernética',true,'Anual','Presidência · Comitê de Crise · CNJ','POSIC art. 8º, III · Res. CNJ 396/2021','POSIC',1),
('R02','Relatório Anual de Testes de Invasão e Vulnerabilidades',true,'Anual','CGSI · Presidência','POSIC art. 8º, II','POSIC',2),
('R03','Plano de Tratamento de Riscos e Riscos Residuais Aceitos',true,'Anual','CGSI','POSIC art. 9º, §2º','POSIC',3),
('R04','Relatório de Conformidade da PUA (KPIs)',true,'Trimestral','CGSI','PUA · POSIC art. 8º','PUA',4),
('R05','Relatório de Indicadores da Classificação da Informação',true,'Semestral','CGSI','PCI art. 46','PCI',5),
('R06','Relatório de Conformidade Criptográfica',true,'Semestral','CGSI','PCUC arts. 9º, VI, e 54, IV','PCUC',6),
('R07','Relatório de Gestão de Ativos (iGovTIC-JUD)',true,'Semestral','CGSI','PGA-TIC art. 47 · Res. CNJ 370/2021','PGA',7),
('R08','Relatório Anual do Programa Preventivo (PPINC)',true,'Anual','CGSI · Presidência · CNJ','PPINC art. 48','PPINC',8),
('R09','Relatório Final de Lições Aprendidas de Crise',true,'Por evento (30 dias)','CGSI','PGCRC art. 50','PGCRC',9),
('R10','Relatório de Indicadores do PIILC-PJ',true,'Semestral','CGSI','PIILC art. 47','PIILC',10),
('R11','Relatório de Auditoria Anual da Cadeia de Custódia',true,'Anual','CGSI','PIILC art. 48','PIILC',11),
('R12','Painel de Infraestruturas Críticas e Nuvem',true,'Semestral','CGSI · Presidência','PPIC-Nuvem art. 36','PPIC',12),
('R13','Relatório de Asseguração da Capacidade de Recuperação',true,'Anual','CGSI','PBRD art. 21','PBRD',13),
('R14','Relatório Anual de Resultados da PECC',true,'Anual','CGSI · Presidência','PECC art. 37','PECC',14),
('R15','Indicadores da Cadeia de Suprimentos (PSFT)',true,'Semestral','CGSI · Presidência','PSFT art. 52','PSFT',15),
('R16','Indicadores de Segurança de Software (PDSS)',true,'Trimestral','CGSI','PDSS arts. 10, VI, e 30','PDSS',16),
('R17','Comunicação de Incidente com Dados Pessoais',true,'Por evento','ANPD · Titulares · CNJ','POSIC art. 13, §3º · LGPD art. 48','POSIC',17),
('R90','Relatório de prestação de contas a comissão ou comitê',false,'Sob demanda','Comissões e comitês','Demanda institucional',NULL,18),
('R91','Relatório para auditoria interna ou externa',false,'Sob demanda','Auditoria Interna · TCE · CNJ','Requisição de órgão de controle',NULL,19),
('R92','Relatório executivo de situação do SGSI',false,'Sob demanda','Alta Administração','Gestão institucional',NULL,20),
('R93','Extrato de conformidade por instrumento normativo',false,'Sob demanda','Unidades executoras','Acompanhamento interno',NULL,21)
ON CONFLICT (codigo) DO NOTHING;
