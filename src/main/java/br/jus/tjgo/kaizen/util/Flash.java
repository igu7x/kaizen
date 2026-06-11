package br.jus.tjgo.kaizen.util;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Utilitário para adicionar Cabeçalhos Flash Notice às respostas HTTP.
 */
public class Flash {

    public static String encode(String message) {
        if (message == null) return "";
        try {
            return URLEncoder.encode(message, StandardCharsets.UTF_8).replace("+", "%20");
        } catch (Exception e) {
            return message;
        }
    }

    public static <T> ResponseEntity<T> success(T body, String message) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Flash-Success", encode(message));
        return ResponseEntity.status(HttpStatus.OK).headers(headers).body(body);
    }

    public static <T> ResponseEntity<T> notice(T body, String message) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Flash-Notice", encode(message));
        return ResponseEntity.status(HttpStatus.OK).headers(headers).body(body);
    }

    public static <T> ResponseEntity<T> error(T body, String message, HttpStatus status) {
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Flash-Error", encode(message));
        return ResponseEntity.status(status).headers(headers).body(body);
    }
}
