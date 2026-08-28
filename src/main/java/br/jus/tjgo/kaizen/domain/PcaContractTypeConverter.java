package br.jus.tjgo.kaizen.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.text.Normalizer;
import java.util.Map;

@Converter(autoApply = true)
public class PcaContractTypeConverter implements AttributeConverter<Pca.PcaContractTypeEnum, String> {

    // Mapeamento de valores legados do banco para os enums corretos
    private static final Map<String, Pca.PcaContractTypeEnum> LEGACY_MAP = Map.of(
            "RENOVACAO", Pca.PcaContractTypeEnum.RENOVACAO,
            "NOVA_CONTRATACAO", Pca.PcaContractTypeEnum.NOVA_CONTRATACAO
    );

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
        // Tenta correspondência exata primeiro
        for (Pca.PcaContractTypeEnum e : Pca.PcaContractTypeEnum.values()) {
            if (e.getValue().equals(dbData)) {
                return e;
            }
        }
        // Tenta correspondência por valores legados (ex: RENOVACAO, NOVA_CONTRATACAO)
        String upperData = dbData.trim().toUpperCase();
        if (LEGACY_MAP.containsKey(upperData)) {
            return LEGACY_MAP.get(upperData);
        }
        // Tenta correspondência ignorando acentos e case
        String normalizedDbData = stripAccents(dbData).toUpperCase();
        for (Pca.PcaContractTypeEnum e : Pca.PcaContractTypeEnum.values()) {
            String normalizedEnum = stripAccents(e.getValue()).toUpperCase();
            if (normalizedEnum.equals(normalizedDbData)) {
                return e;
            }
        }
        throw new IllegalArgumentException("Valor desconhecido no banco de dados para PcaContractTypeEnum: " + dbData);
    }

    private static String stripAccents(String input) {
        if (input == null) return null;
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD);
        return normalized.replaceAll("[\\p{InCombiningDiacriticalMarks}]", "");
    }
}
