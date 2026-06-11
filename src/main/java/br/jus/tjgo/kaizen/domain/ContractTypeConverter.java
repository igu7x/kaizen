package br.jus.tjgo.kaizen.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ContractTypeConverter implements AttributeConverter<Contract.ContractTypeEnum, String> {

    @Override
    public String convertToDatabaseColumn(Contract.ContractTypeEnum attribute) {
        if (attribute == null) {
            return null;
        }
        return attribute.getValue();
    }

    @Override
    public Contract.ContractTypeEnum convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        for (Contract.ContractTypeEnum e : Contract.ContractTypeEnum.values()) {
            if (e.getValue().equals(dbData)) {
                return e;
            }
        }
        throw new IllegalArgumentException("Valor desconhecido no banco de dados para ContractTypeEnum: " + dbData);
    }
}
