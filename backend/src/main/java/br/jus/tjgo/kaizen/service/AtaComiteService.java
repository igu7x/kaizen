package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

/**
 * Juntada das atas dos comitês (CGTIC/CGOVTIC) — RN-GERAL-04. O Kaizen reflete o ato externo
 * (deliberação no PROAD) pela inclusão do registro/anexo da ata. Ação do escopo SGJT (Editor SGJT
 * junta; Secretário SGJT é a Autoridade) — validada em {@link OrcamentoPapelService#exigirEdicao}.
 *
 * <p>Fluxo de consistência (Storage vs Banco):
 * <ul>
 *   <li><b>Upload:</b> 1º S3, 2º Banco (com compensação — se o INSERT falhar, o arquivo é removido do S3).</li>
 *   <li><b>Exclusão:</b> 1º Banco, 2º S3 (best effort — arquivo órfão logado como warning).</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AtaComiteService {

    private final JdbcTemplate jdbc;
    private final OrcamentoPapelService papelService;
    private final StorageService storageService;

    private static final List<String> COMITES = List.of("cgtic", "cgovtic");

    /**
     * Registra uma ata com upload opcional de arquivo para o S3.
     *
     * @param fileStream stream do arquivo (pode ser {@code null} se não houver anexo físico)
     */
    @Transactional
    public Map<String, Object> registrar(Long cicloId, String comite, String numero, String dataAta,
                                         String decisao, String anexoUrl, Long userId,
                                         String originalFilename, String contentType,
                                         long fileSize, InputStream fileStream) {
        papelService.exigirEdicao("sgjt", cicloId);
        String c = comite == null ? "" : comite.trim().toLowerCase();
        if (!COMITES.contains(c)) {
            throw new ApiException(400, "Comitê inválido (use cgtic ou cgovtic)");
        }

        // --- Upload S3 (se houver arquivo) ---
        String fileKey = null;
        if (fileStream != null && originalFilename != null && !originalFilename.isBlank()) {
            storageService.validarArquivo(originalFilename, fileSize);
            fileKey = storageService.upload(cicloId, c, originalFilename, contentType, fileSize, fileStream);
        }

        try {
            // --- Persistir metadados no banco ---
            var rows = jdbc.queryForList(
                    """
                    INSERT INTO atas_comites (ciclo_id, comite, numero, data_ata, decisao,
                        anexo_url, file_key, original_filename, content_type, file_size,
                        uploaded_at, created_by)
                    VALUES (?, ?, ?, CAST(? AS DATE), ?, ?, ?, ?, ?, ?, NOW(), ?)
                    RETURNING *
                    """,
                    cicloId, c, numero,
                    (dataAta == null || dataAta.isBlank()) ? null : dataAta,
                    decisao, anexoUrl,
                    fileKey, fileKey != null ? originalFilename : null,
                    fileKey != null ? contentType : null,
                    fileSize > 0 && fileKey != null ? fileSize : null,
                    userId);
            return rows.get(0);
        } catch (Exception ex) {
            // COMPENSAÇÃO: rollback do S3 em caso de falha no banco
            if (fileKey != null) {
                try {
                    storageService.delete(fileKey);
                    log.warn("[AtaComite] Compensação S3: '{}' removido após falha no banco", fileKey);
                } catch (Exception s3ex) {
                    log.error("[AtaComite] FALHA na compensação S3 para key '{}': {}",
                            fileKey, s3ex.getMessage());
                }
            }
            throw ex;
        }
    }

    public List<Map<String, Object>> listar(Long cicloId) {
        if (cicloId == null) {
            return jdbc.queryForList("SELECT * FROM atas_comites ORDER BY id DESC");
        }
        return jdbc.queryForList("SELECT * FROM atas_comites WHERE ciclo_id = ? ORDER BY id DESC", cicloId);
    }

    /**
     * Busca os metadados de uma ata pelo ID.
     *
     * @throws ApiException 404 se não encontrada
     */
    public Map<String, Object> buscarPorId(long id) {
        var rows = jdbc.queryForList("SELECT * FROM atas_comites WHERE id = ?", id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "Ata não encontrada");
        }
        return rows.get(0);
    }

    @Transactional
    public void excluir(long id) {
        var rows = jdbc.queryForList("SELECT * FROM atas_comites WHERE id = ?", id);
        if (rows.isEmpty()) {
            throw new ApiException(404, "Ata não encontrada");
        }
        Long cicloId = rows.get(0).get("ciclo_id") == null ? null : ((Number) rows.get(0).get("ciclo_id")).longValue();
        papelService.exigirEdicao("sgjt", cicloId);

        String fileKey = (String) rows.get(0).get("file_key");
        jdbc.update("DELETE FROM atas_comites WHERE id = ?", id);

        // Limpar S3 após sucesso no banco (best effort)
        if (fileKey != null && !fileKey.isBlank()) {
            try {
                storageService.delete(fileKey);
            } catch (Exception e) {
                log.warn("[AtaComite] Arquivo órfão no S3 (key='{}'): {}", fileKey, e.getMessage());
            }
        }
    }
}
