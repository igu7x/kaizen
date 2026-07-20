-- liquibase formatted sql
-- changeset kaizen:184_update_ciclo_estado_inicial

-- Atualiza o estado inicial legado para o novo estado desmembrado
UPDATE ciclo_orcamentario SET estado = 'aguardando_proad' WHERE estado = 'aberto_aguardando_proad';

-- rollback UPDATE ciclo_orcamentario SET estado = 'aberto_aguardando_proad' WHERE estado = 'aguardando_proad';
