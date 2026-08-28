package br.jus.tjgo.kaizen.dto;

import java.util.List;

public record ContractPlanDto(
        Long id,
        Long pcaId,
        String pcaCode,
        String pcaYear,
        String objectName,
        Long cadastrosAreasId,
        Long cadastrosUnidadesId,
        String areaSigla,
        String unidadeNome,
        String description,
        String justification,
        Long estimatedValueCents,
        Integer priorityLevel,
        Integer status,
        Integer step,
        String situation,
        String estimatedDate,
        String loaReference,
        String proadNumber,
        String ipcCode,
        int contractsCount,
        List<ContractPlanMemberDto> members,
        List<ContractPlanAttachmentDto> attachments,
        ContractPlanNoteDto lastUserNote
) {

    public record ContractPlanMemberDto(
            Long id,
            Long userId,
            String role,
            String signedAt,
            String signatureStatus,
            String rejectReason
    ) {}

    public record ContractPlanAttachmentDto(
            Long id,
            String fileName,
            String fileKey,
            Long fileSize,
            String contentType,
            String documentType,
            Long uploadedBy,
            String uploadedAt
    ) {}

    public record ContractPlanNoteDto(
            Long id,
            Long userId,
            String message,
            String location,
            Boolean isSystemEvent,
            String createdAt,
            String createdBy
    ) {}
}
