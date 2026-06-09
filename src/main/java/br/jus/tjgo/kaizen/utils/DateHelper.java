package br.jus.tjgo.kaizen.utils;

import java.sql.Date;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;

public class DateHelper {
    
    /**
     * Converte um valor genérico (geralmente String no formato yyyy-MM-dd) para java.sql.Date.
     * Retorna null se o valor for nulo, vazio ou inválido.
     */
    public static Date toSqlDate(Object value) {
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value).trim();
        if (s.isEmpty()) {
            return null;
        }
        try {
            // Pega apenas a parte da data caso venha com tempo (ex: 2025-01-01T00:00:00.000Z)
            String datePart = s.length() > 10 ? s.substring(0, 10) : s;
            return Date.valueOf(LocalDate.parse(datePart));
        } catch (DateTimeParseException e) {
            return null; // ou lançar uma ApiException se a validação estrita for necessária
        }
    }
}
