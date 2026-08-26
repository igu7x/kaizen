package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.auth.TagAcao;
import br.jus.tjgo.kaizen.domain.ContractRiskAssessment;
import br.jus.tjgo.kaizen.service.ContractRiskAssessmentService;
import br.jus.tjgo.kaizen.service.PermissoesAcoesService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/contract-risk-assessment")
@RequiredArgsConstructor
public class ContractRiskAssessmentController {

    private final ContractRiskAssessmentService service;
    private final PermissoesAcoesService permissoesAcoesService;

    private Long getCurrentUserId() {
        return AuthContext.getCurrentUser()
                .map(user -> user.id())
                .orElse(1L); // Fallback for local testing based on UserController pattern
    }

    @PostMapping
    @TagAcao("PC_AR_CRUD")
    public ResponseEntity<?> startAssessment(
            @RequestParam("apiToken") String apiToken,
            @RequestParam(value = "dod", required = false) MultipartFile dod,
            @RequestParam(value = "etp", required = false) MultipartFile etp,
            @RequestParam(value = "tr", required = false) MultipartFile tr) {
        
        try {
            Long userId = getCurrentUserId();
            ContractRiskAssessment assessment = service.startcontractRiskAssessment(userId, apiToken, dod, etp, tr);
            
            // Inicia o processamento asincrono (lendo os bytes de forma sincrona para evitar delecao prematura dos temporarios)
            java.util.List<br.jus.tjgo.kaizen.integration.gemini.dto.AnexoDTO> anexos = new java.util.ArrayList<>();
            if (dod != null && !dod.isEmpty()) anexos.add(new br.jus.tjgo.kaizen.integration.gemini.dto.AnexoDTO(java.util.Base64.getEncoder().encodeToString(dod.getBytes()), dod.getContentType()));
            if (etp != null && !etp.isEmpty()) anexos.add(new br.jus.tjgo.kaizen.integration.gemini.dto.AnexoDTO(java.util.Base64.getEncoder().encodeToString(etp.getBytes()), etp.getContentType()));
            if (tr != null && !tr.isEmpty()) anexos.add(new br.jus.tjgo.kaizen.integration.gemini.dto.AnexoDTO(java.util.Base64.getEncoder().encodeToString(tr.getBytes()), tr.getContentType()));

            service.processcontractRiskAssessment(assessment.getId(), apiToken, anexos);

            return ResponseEntity.status(HttpStatus.ACCEPTED).body(assessment);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to start assessment", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to start assessment"));
        }
    }

    @GetMapping
    public ResponseEntity<Page<ContractRiskAssessment>> listAssessments(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "6") int size) {
        
        boolean hasCrudPermission = AuthContext.getCurrentUser()
                .map(user -> user.isSuperadmin() || permissoesAcoesService.validarAcesso(user.id(), "PC_AR_CRUD"))
                .orElse(false);

        return ResponseEntity.ok(service.listcontractRiskAssessments(getCurrentUserId(), search, page, size, hasCrudPermission));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getAssessment(@PathVariable Long id) {
        boolean hasCrudPermission = AuthContext.getCurrentUser()
                .map(user -> user.isSuperadmin() || permissoesAcoesService.validarAcesso(user.id(), "PC_AR_CRUD"))
                .orElse(false);

        return service.getcontractRiskAssessment(id, getCurrentUserId(), hasCrudPermission)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @DeleteMapping("/{id}")
    @TagAcao("PC_AR_CRUD")
    public ResponseEntity<?> deleteAssessment(@PathVariable Long id) {
        try {
            service.deletecontractRiskAssessment(id, getCurrentUserId());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{id}")
    @TagAcao("PC_AR_CRUD")
    public ResponseEntity<?> updateAssessment(@PathVariable Long id, @RequestBody Map<String, Object> requestMap) {
        try {
            if (requestMap == null || requestMap.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Empty body"));
            }
            
            // O frontend ira enviar o novo JSONB, precisamos serializa-lo para string
            // Dependendo de como o Jackson o converte, podemos transforma-lo numa string JSON usando um ObjectMapper
            // Como este e um mapa, vamos apenas converte-lo pra JSON.
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            String jsonBody = mapper.writeValueAsString(requestMap);
            
            service.updatecontractRiskAssessmentBody(id, getCurrentUserId(), jsonBody);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Error updating assessment body", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping(consumes = org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
    @TagAcao("PC_AR_CRUD")
    public ResponseEntity<?> createManualAssessment(@RequestBody Map<String, Object> requestMap) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            String jsonBody = mapper.writeValueAsString(requestMap);
            ContractRiskAssessment assessment = service.createManualAssessment(getCurrentUserId(), jsonBody);
            return ResponseEntity.status(HttpStatus.CREATED).body(assessment);
        } catch (Exception e) {
            log.error("Error creating manual assessment", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/{id}/validate")
    @TagAcao("PC_AR_CRUD")
    public ResponseEntity<?> validateAssessment(@PathVariable Long id) {
        try {
            service.validateAssessment(id, getCurrentUserId());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Error validating assessment", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/{id}/recover-validation")
    @TagAcao("PC_AR_CRUD")
    public ResponseEntity<?> recoverValidation(@PathVariable Long id) {
        try {
            service.recoverValidation(id, getCurrentUserId());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Error recovering validation", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
