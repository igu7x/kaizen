package br.jus.tjgo.kaizen.util;

import java.math.BigInteger;

/**
 * Código de validação de autenticidade de documento (processo de negócio).
 *
 * <p>Bijeção reversível id ↔ código: {@code codigo = (id * P) mod MOD}, formatado em 12 dígitos.
 * Permite recuperar o processo a partir do código impresso no PDF sem armazenar nada em banco.
 * {@code P} é primo e coprimo a {@code MOD = 10^12}, então o mapeamento é injetivo para todo id
 * válido e possui inverso modular ({@code P_INV}).
 *
 * <p>Este código NÃO é um segredo: a barreira de acesso ao documento é a autenticação no Kaizen
 * (login). O código apenas identifica qual documento validar.
 */
public final class CodigoValidacao {

    private static final long MOD = 1_000_000_000_000L; // 12 dígitos
    private static final BigInteger BMOD = BigInteger.valueOf(MOD);
    private static final BigInteger P = BigInteger.valueOf(982_451_653L); // primo, coprimo a MOD
    private static final BigInteger P_INV = P.modInverse(BMOD);

    private CodigoValidacao() {
    }

    /** Código de 12 dígitos a partir do id do processo. */
    public static String fromId(long id) {
        long c = BigInteger.valueOf(id).multiply(P).mod(BMOD).longValueExact();
        return String.format("%012d", c);
    }

    /** Id do processo a partir do código, ou {@code null} se o código for inválido. */
    public static Long toId(String codigo) {
        if (codigo == null) {
            return null;
        }
        String digits = codigo.replaceAll("\\D", "");
        if (digits.isEmpty() || digits.length() > 12) {
            return null;
        }
        try {
            long c = Long.parseLong(digits);
            return BigInteger.valueOf(c).multiply(P_INV).mod(BMOD).longValueExact();
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
