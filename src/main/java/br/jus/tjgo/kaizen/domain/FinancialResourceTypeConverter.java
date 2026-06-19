package br.jus.tjgo.kaizen.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class FinancialResourceTypeConverter implements AttributeConverter<Pca.FinancialResourceTypeEnum, String> {

    @Override
    public String convertToDatabaseColumn(Pca.FinancialResourceTypeEnum attribute) {
        if (attribute == null) {
            return null;
        }
        return attribute.getValue();
    }

    @Override
    public Pca.FinancialResourceTypeEnum convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        for (Pca.FinancialResourceTypeEnum e : Pca.FinancialResourceTypeEnum.values()) {
            if (e.getValue().equals(dbData)) {
                return e;
            }
        }
        throw new IllegalArgumentException("Valor desconhecido no banco de dados para FinancialResourceTypeEnum: " + dbData);
    }
}
