package br.jus.tjgo.kaizen.util;

import br.jus.tjgo.kaizen.exception.ApiException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.regex.Pattern;

/**
 * Hash de senha SHA-256 hex — paridade com o Node (user.service.ts usa crypto.createHash('sha256')).
 * O frontend já envia a senha hasheada; ensureHash mantém se já for hash de 64 hex.
 */
public final class PasswordHasher {

    private static final Pattern SHA256_HEX = Pattern.compile("^[a-f0-9]{64}$", Pattern.CASE_INSENSITIVE);
    private static final SecureRandom RANDOM = new SecureRandom();

    private PasswordHasher() {
    }

    public static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new ApiException(500, "SHA-256 indisponível", e);
        }
    }

    /** Se já é hash SHA-256 (64 hex), mantém; senão hasheia. */
    public static String ensureHash(String password) {
        if (password != null && SHA256_HEX.matcher(password).matches()) {
            return password;
        }
        return sha256Hex(password);
    }

    /** Hash aleatório para usuários SSO-only (schema exige password_hash NOT NULL). */
    public static String generateRandomPasswordHash() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sha256Hex("SSO_ONLY_" + sb);
    }
}
