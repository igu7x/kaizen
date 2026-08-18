-- changeset kaizen:248_add_validation_contract_risk_assessments
ALTER TABLE contract_risk_assessments ADD COLUMN validated_by_id BIGINT;
ALTER TABLE contract_risk_assessments ADD COLUMN validated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE contract_risk_assessments ADD CONSTRAINT fk_contract_risk_assessments_validated_user FOREIGN KEY (validated_by_id) REFERENCES users(id);

CREATE TABLE contract_risk_assessment_validations (
    id BIGSERIAL PRIMARY KEY,
    assessment_id BIGINT NOT NULL,
    body JSONB NOT NULL,
    validated_by_id BIGINT NOT NULL,
    validated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_cra_validations_assessment FOREIGN KEY (assessment_id) REFERENCES contract_risk_assessments(id) ON DELETE CASCADE,
    CONSTRAINT fk_cra_validations_user FOREIGN KEY (validated_by_id) REFERENCES users(id)
);
