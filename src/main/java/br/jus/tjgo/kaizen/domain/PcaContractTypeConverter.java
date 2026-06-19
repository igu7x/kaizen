package br.jus.tjgo.kaizen.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class PcaContractTypeConverter implements AttributeConverter<Pca.PcaContractTypeEnum, String> {

    @Override
    public String convertToDatabaseColumn(Pca.PcaContractTypeEnum attribute) {
        if (attribute == null) {
            return null;
        }
        return attribute.getValue();
    }

    @Override
    public Pca.PcaContractTypeEnum convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        for (Pca.PcaContractTypeEnum e : Pca.PcaContractTypeEnum.values()) {
            if (e.getValue().equals(dbData)) {
                return e;
            }
        }
        throw new IllegalArgumentException("Valor desconhecido no banco de dados para PcaContractTypeEnum: " + dbData);
    }
}
