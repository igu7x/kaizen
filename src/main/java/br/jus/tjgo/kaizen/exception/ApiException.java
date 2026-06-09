package br.jus.tjgo.kaizen.exception;

import lombok.Getter;

/**
 * Excecao de negocio com status HTTP. Espelha o padrao do Node (err.status + err.message).
 */
@Getter
public class ApiException extends RuntimeException {

    private final int statusCode;

    public ApiException(int statusCode, String message) {
        super(message);
        this.statusCode = statusCode;
    }

    public ApiException(int statusCode, String message, Throwable cause) {
        super(message, cause);
        this.statusCode = statusCode;
    }
}
