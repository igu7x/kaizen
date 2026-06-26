package br.jus.tjgo.kaizen.utils;

import java.util.Map;

/**
 * Códigos organizacionais usados na nomenclatura dos IDs (Processo e Projeto):
 *   ID Processo: PN_{macroArea}_{diretoria}_{seq}            ex.: PN_1_2_001
 *   ID Projeto:  PRJ_{macroArea}_{diretoria}_{ano}_{seq}     ex.: PRJ_1_2_2025_001
 *
 * Macro área hoje é sempre SGJT (1); as diretorias atuais são todas sob a SGJT.
 */
public final class OrgCodigos {

    /** Código da macro área (SGJT). Fixo enquanto só existe uma secretaria. */
    public static final String MACRO_AREA = "1";

    /** Sigla da diretoria -> código (dígito único). */
    public static final Map<String, String> DIRETORIA = Map.of(
            "SGJT", "1",
            "GEJUT", "2",
            "DIJUD", "3",
            "DPE", "4",
            "DITI", "5",
            "DSTI", "6");

    /** Código da diretoria pela sigla; "0" se não mapeada. */
    public static String diretoria(String sigla) {
        return DIRETORIA.getOrDefault(sigla, "0");
    }

    private OrgCodigos() {}
}
