package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.domain.ContractPlan;
import br.jus.tjgo.kaizen.domain.ContractPlanAttachment;
import br.jus.tjgo.kaizen.domain.ContractPlanMember;
import br.jus.tjgo.kaizen.domain.ContractPlanNote;
import br.jus.tjgo.kaizen.dto.ContractPlanDto;
import br.jus.tjgo.kaizen.dto.CreateContractPlanRequest;
import br.jus.tjgo.kaizen.dto.UpdateContractPlanRequest;
import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.service.ContractPlanService;
import br.jus.tjgo.kaizen.service.StorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/contract-plans")
@RequiredArgsConstructor
public class ContractPlansController {

    private final ContractPlanService contractPlanService;
    private final StorageService storageService;
    private final ObjectMapper objectMapper;

    // ============================================================
    // DTO mapping
    // ============================================================

    private ContractPlanDto toDto(ContractPlan plan) {
        return new ContractPlanDto(
                plan.getId(),
                plan.getPca() != null ? plan.getPca().getId() : null,
                plan.getPca() != null ? plan.getPca().getCode() : null,
                plan.getPca() != null ? plan.getPca().getYear() : null,
                plan.getObjectName(),
                plan.getCadastrosAreasId(),
                plan.getCadastrosUnidadesId(),
                plan.getAreaSigla(),
                plan.getUnidadeNome(),
                plan.getDescription(),
                plan.getJustification(),
                plan.getEstimatedValueCents(),
                plan.getPriorityLevel(),
                plan.getStatus(),
                plan.getStep(),
                plan.getSituation(),
                plan.getEstimatedDate() != null ? plan.getEstimatedDate().toString() : null,
                plan.getLoaReference(),
                plan.getProadNumber(),
                plan.getIpcCode(),
                plan.getContracts().size(),
                plan.getMembers().stream().map(this::toMemberDto).toList(),
                plan.getAttachments().stream()
                        .filter(a -> !a.getIsDeleted())
                        .map(this::toAttachmentDto).toList(),
                plan.getLastUserNote() != null ? toNoteDto(plan.getLastUserNote()) : null,
                plan.getPca() != null && plan.getPca().getContractType() != null ? plan.getPca().getContractType().getValue() : null
        );
    }

    private ContractPlanDto.ContractPlanMemberDto toMemberDto(ContractPlanMember m) {
        return new ContractPlanDto.ContractPlanMemberDto(
                m.getId(),
                m.getUserId(),
                m.getRole(),
                m.getSignedAt() != null ? m.getSignedAt().toString() : null,
                m.getSignatureStatus(),
                m.getRejectReason()
        );
    }

    private ContractPlanDto.ContractPlanAttachmentDto toAttachmentDto(ContractPlanAttachment a) {
        return new ContractPlanDto.ContractPlanAttachmentDto(
                a.getId(),
                a.getFileName(),
                a.getFileKey(),
                a.getFileSize(),
                a.getContentType(),
                a.getDocumentType(),
                a.getUploadedBy(),
                a.getUploadedAt() != null ? a.getUploadedAt().toString() : null
        );
    }

    private ContractPlanDto.ContractPlanNoteDto toNoteDto(ContractPlanNote n) {
        return new ContractPlanDto.ContractPlanNoteDto(
                n.getId(),
                n.getUserId(),
                n.getMessage(),
                n.getLocation(),
                n.getIsSystemEvent(),
                n.getCreatedAt() != null ? n.getCreatedAt().toString() : null,
                n.getCreatedBy()
        );
    }

    // ============================================================
    // CRUD principal — Contract Plans
    // ============================================================

    @GetMapping
    public List<ContractPlanDto> list(
            @RequestParam(required = false) Long pcaId,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String diretoriaSigla,
            @RequestHeader("x-user-id") Long userId) {
        return contractPlanService.findAll(pcaId, status, diretoriaSigla, userId)
                .stream().map(this::toDto).toList();
    }

    @GetMapping("/{id}")
    public ContractPlanDto get(@PathVariable Long id, @RequestHeader("x-user-id") Long userId) {
        return toDto(contractPlanService.findById(id, userId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ContractPlanDto create(@RequestBody CreateContractPlanRequest req, @RequestHeader("x-user-id") Long userId) {
        return toDto(contractPlanService.create(req, userId));
    }

    @PutMapping("/{id}")
    public ContractPlanDto update(@PathVariable Long id, @RequestBody UpdateContractPlanRequest req, @RequestHeader("x-user-id") Long userId) {
        return toDto(contractPlanService.update(id, req, userId));
    }

    @PutMapping("/{id}/status")
    public ContractPlanDto updateStatus(@PathVariable Long id, @RequestBody Map<String, Integer> body, @RequestHeader("x-user-id") Long userId) {
        return toDto(contractPlanService.updateStatus(id, body.get("status"), userId));
    }

    @PutMapping("/{id}/step")
    public ContractPlanDto updateStep(@PathVariable Long id, @RequestBody Map<String, Integer> body, @RequestHeader("x-user-id") Long userId) {
        return toDto(contractPlanService.updateStep(id, body.get("step"), userId));
    }



    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @RequestHeader("x-user-id") Long userId) {
        contractPlanService.softDelete(id, userId);
    }

    // ============================================================
    // Membros (papéis / assinantes do DOD)
    // ============================================================

    @GetMapping("/{id}/members")
    public List<ContractPlanDto.ContractPlanMemberDto> listMembers(
            @PathVariable Long id, @RequestHeader("x-user-id") Long userId) {
        contractPlanService.findById(id, userId); // valida acesso
        return contractPlanService.findMembers(id).stream().map(this::toMemberDto).toList();
    }

    @PostMapping("/{id}/members")
    @ResponseStatus(HttpStatus.CREATED)
    public ContractPlanDto.ContractPlanMemberDto addMember(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @RequestHeader("x-user-id") Long userId) {
        Long memberUserId = ((Number) body.get("userId")).longValue();
        String role = (String) body.get("role");
        return toMemberDto(contractPlanService.addMember(id, userId, memberUserId, role));
    }

    @DeleteMapping("/{id}/members/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(
            @PathVariable Long id,
            @PathVariable Long memberId,
            @RequestHeader("x-user-id") Long userId) {
        contractPlanService.removeMember(id, memberId, userId);
    }

    // ============================================================
    // Anexos (documentos categorizados — upload/download S3)
    // ============================================================

    @GetMapping("/{id}/attachments")
    public List<ContractPlanDto.ContractPlanAttachmentDto> listAttachments(
            @PathVariable Long id,
            @RequestParam(required = false) String documentType,
            @RequestHeader("x-user-id") Long userId) {
        contractPlanService.findById(id, userId);
        if (documentType != null) {
            return contractPlanService.findAttachmentsByType(id, documentType)
                    .stream().map(this::toAttachmentDto).toList();
        }
        return contractPlanService.findAttachments(id).stream().map(this::toAttachmentDto).toList();
    }

    @PostMapping(value = "/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ContractPlanDto.ContractPlanAttachmentDto uploadAttachment(
            @PathVariable Long id,
            @RequestPart("arquivo") MultipartFile arquivo,
            @RequestPart("documentType") String documentType,
            @RequestHeader("x-user-id") Long userId) {
        try (InputStream stream = arquivo.getInputStream()) {
            ContractPlanAttachment att = contractPlanService.uploadAttachment(
                    id, userId, documentType.trim(),
                    arquivo.getOriginalFilename(), arquivo.getContentType(),
                    arquivo.getSize(), stream);
            return toAttachmentDto(att);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("[ContractPlan] Erro ao fazer upload de anexo", e);
            throw new ApiException(500, "Erro interno ao fazer upload: " + e.getMessage());
        }
    }

    @GetMapping("/{id}/attachments/{attachmentId}/download")
    public ResponseEntity<StreamingResponseBody> downloadAttachment(
            @PathVariable Long id,
            @PathVariable Long attachmentId,
            @RequestHeader("x-user-id") Long userId) {
        ContractPlanAttachment att = contractPlanService.findAttachments(id).stream()
                .filter(a -> a.getId().equals(attachmentId))
                .findFirst()
                .orElseThrow(() -> new ApiException(404, "Anexo não encontrado"));

        StreamingResponseBody body = outputStream -> {
            try (InputStream s3Stream = contractPlanService.downloadAttachment(id, attachmentId, userId)) {
                s3Stream.transferTo(outputStream);
            }
        };

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                att.getContentType() != null ? att.getContentType() : "application/octet-stream"));
        headers.set(HttpHeaders.CONTENT_DISPOSITION,
                "inline; filename=\"" + att.getFileName() + "\"");
        if (att.getFileSize() != null) {
            headers.setContentLength(att.getFileSize());
        }

        return ResponseEntity.ok().headers(headers).body(body);
    }

    @PatchMapping("/{id}/attachments/{attachmentId}/type")
    public ContractPlanDto.ContractPlanAttachmentDto updateAttachmentType(
            @PathVariable Long id,
            @PathVariable Long attachmentId,
            @RequestBody Map<String, String> body,
            @RequestHeader("x-user-id") Long userId) {
        return toAttachmentDto(contractPlanService.updateAttachmentType(id, attachmentId, body.get("documentType"), userId));
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAttachment(
            @PathVariable Long id,
            @PathVariable Long attachmentId,
            @RequestHeader("x-user-id") Long userId) {
        contractPlanService.softDeleteAttachment(id, attachmentId, userId);
    }

    // ============================================================
    // Notas (Interlocução)
    // ============================================================

    @GetMapping("/{id}/notes")
    public List<ContractPlanDto.ContractPlanNoteDto> listNotes(
            @PathVariable Long id,
            @RequestHeader("x-user-id") Long userId) {
        return contractPlanService.getNotes(id, userId).stream().map(this::toNoteDto).toList();
    }

    @PostMapping("/{id}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public ContractPlanDto.ContractPlanNoteDto addNote(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @RequestHeader("x-user-id") Long userId) {
        String location = body.get("location");
        return toNoteDto(contractPlanService.addNote(id, body.get("message"), location, userId));
    }

    @DeleteMapping("/{id}/notes/{noteId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNote(
            @PathVariable Long id,
            @PathVariable Long noteId,
            @RequestHeader("x-user-id") Long userId) {
        contractPlanService.deleteNote(id, noteId, userId);
    }
}
