package br.jus.tjgo.kaizen.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class PcaStepConverter implements AttributeConverter<Pca.PcaStepEnum, String> {

    @Override
    public String convertToDatabaseColumn(Pca.PcaStepEnum attribute) {
        if (attribute == null) {
            return null;
        }
        return attribute.getValue();
    }

    @Override
    public Pca.PcaStepEnum convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }
        for (Pca.PcaStepEnum e : Pca.PcaStepEnum.values()) {
            if (e.getValue().equals(dbData) || e.name().equals(dbData)) {
                return e;
            }
        }
        return null; // Retorna null ao invés de quebrar a aplicação caso encontre lixo no banco
    }
}
