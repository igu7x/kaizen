-- changeset system:162_update_pcas_directory_acronym
UPDATE pcas p
SET directory_acronym = (
    SELECT ca.sigla
    FROM cadastros_areas ca
    WHERE ca.id = p.id_cadastros_areas
)
WHERE p.id_cadastros_areas IS NOT NULL;
