package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.domain.ContractPlan;
import br.jus.tjgo.kaizen.domain.ContractPlanAttachment;
import br.jus.tjgo.kaizen.domain.ContractPlanMember;

import br.jus.tjgo.kaizen.domain.Pca;
import br.jus.tjgo.kaizen.dto.CreateContractPlanRequest;
import br.jus.tjgo.kaizen.dto.UpdateContractPlanRequest;
import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.repository.ContractPlanAttachmentRepository;
import br.jus.tjgo.kaizen.repository.ContractPlanMemberRepository;
import br.jus.tjgo.kaizen.repository.ContractPlanNoteRepository;
import br.jus.tjgo.kaizen.repository.ContractPlanRepository;
import br.jus.tjgo.kaizen.domain.ContractPlanNote;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.jdbc.core.JdbcTemplate;

import java.io.InputStream;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashMap;
import java.util.Collections;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class ContractPlanService {

    private static final Map<String, Integer> MESES_PT = Map.ofEntries(
            Map.entry("janeiro", 1), Map.entry("fevereiro", 2), Map.entry("marco", 3),
            Map.entry("abril", 4), Map.entry("maio", 5), Map.entry("junho", 6),
            Map.entry("julho", 7), Map.entry("agosto", 8), Map.entry("setembro", 9),
            Map.entry("outubro", 10), Map.entry("novembro", 11), Map.entry("dezembro", 12)
    );

    private static LocalDate parseFlexibleDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        // Tenta ISO format primeiro (2026-03-15)
        try {
            return LocalDate.parse(dateStr.trim());
        } catch (Exception ignored) {}
        // Tenta nome de mês em português (ex: "Março", "Marco")
        String normalized = Normalizer.normalize(dateStr.trim(), Normalizer.Form.NFD)
                .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "")
                .toLowerCase();
        Integer month = MESES_PT.get(normalized);
        if (month != null) {
            return LocalDate.of(LocalDate.now().getYear(), month, 1);
        }
        log.warn("Não foi possível parsear a data estimada: '{}'. Ignorando.", dateStr);
        return null;
    }

    private final ContractPlanRepository contractPlanRepository;
    private final ContractPlanMemberRepository memberRepository;
    private final ContractPlanAttachmentRepository attachmentRepository;
    private final ContractPlanNoteRepository noteRepository;
    private final PcaCoreService pcaCoreService;
    private final PermissoesService permissoesService;
    private final StorageService storageService;
    private final JdbcTemplate jdbc;

    private String resolveUserName(Long userId) {
        try {
            return jdbc.queryForObject("SELECT name FROM users WHERE id = ?", String.class, userId);
        } catch (Exception e) {
            log.warn("Não foi possível buscar nome do usuário {}: {}", userId, e.getMessage());
            return "Usuário " + userId;
        }
    }

    private static final Set<String> VALID_DOCUMENT_TYPES = Set.of("dod", "etp", "tr", "mgr", "am", "outros");
    private static final Set<String> VALID_MEMBER_ROLES = Set.of(
            "INTEGRANTE_DEMANDANTE", "INTEGRANTE_TECNICO", "INTEGRANTE_ADMINISTRATIVO", "AUTORIDADE_TI");
    private static final Set<String> VALID_SITUATIONS = Set.of("Em Instrução", "Concluído");

    private void validateAccess(Long userId, String diretoriaSigla) {
        // TODO: reativar verificação de permissão quando a função PL/pgSQL estiver disponível
    }

    private ContractPlan populateTransientFields(ContractPlan plan) {
        if (plan.getCadastrosAreasId() != null) {
            try {
                String sigla = jdbc.queryForObject("SELECT sigla FROM cadastros_areas WHERE id = ?", String.class, plan.getCadastrosAreasId());
                plan.setAreaSigla(sigla);
            } catch (Exception e) {}
        }
        if (plan.getCadastrosUnidadesId() != null) {
            try {
                String nome = jdbc.queryForObject("SELECT sigla FROM cadastros_unidades WHERE id = ?", String.class, plan.getCadastrosUnidadesId());
                plan.setUnidadeNome(nome);
            } catch (Exception e) {}
        }
        return plan;
    }

    private void populateTransientFieldsBulk(List<ContractPlan> plans) {
        if (plans.isEmpty()) return;

        List<Long> areaIds = plans.stream()
                .map(ContractPlan::getCadastrosAreasId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, String> areasMap = new HashMap<>();
        if (!areaIds.isEmpty()) {
            String inSql = String.join(",", Collections.nCopies(areaIds.size(), "?"));
            jdbc.query(
                    String.format("SELECT id, sigla FROM cadastros_areas WHERE id IN (%s)", inSql),
                    areaIds.toArray(),
                    rs -> {
                        areasMap.put(rs.getLong("id"), rs.getString("sigla"));
                    }
            );
        }

        List<Long> unidadeIds = plans.stream()
                .map(ContractPlan::getCadastrosUnidadesId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, String> unidadesMap = new HashMap<>();
        if (!unidadeIds.isEmpty()) {
            String inSql = String.join(",", Collections.nCopies(unidadeIds.size(), "?"));
            jdbc.query(
                    String.format("SELECT id, sigla FROM cadastros_unidades WHERE id IN (%s)", inSql),
                    unidadeIds.toArray(),
                    rs -> {
                        unidadesMap.put(rs.getLong("id"), rs.getString("sigla"));
                    }
            );
        }

        for (ContractPlan plan : plans) {
            if (plan.getCadastrosAreasId() != null) {
                plan.setAreaSigla(areasMap.get(plan.getCadastrosAreasId()));
            }
            if (plan.getCadastrosUnidadesId() != null) {
                plan.setUnidadeNome(unidadesMap.get(plan.getCadastrosUnidadesId()));
            }
        }
    }

    private void populateLastUserNotesBulk(List<ContractPlan> plans) {
        if (plans.isEmpty()) return;
        List<Long> planIds = plans.stream().map(ContractPlan::getId).toList();
        List<ContractPlanNote> allUserNotes = noteRepository.findByContractPlanIdInAndIsSystemEventFalseOrderByCreatedAtAsc(planIds);
        Map<Long, ContractPlanNote> lastNotesMap = new HashMap<>();
        for (ContractPlanNote note : allUserNotes) {
            lastNotesMap.put(note.getContractPlan().getId(), note); // Overwrites keeping the last one (since it's ordered by createdAt ASC)
        }
        for (ContractPlan plan : plans) {
            plan.setLastUserNote(lastNotesMap.get(plan.getId()));
        }
    }

    public List<ContractPlan> findAll(Long pcaId, Integer status, String diretoriaSigla, Long userId) {
        validateAccess(userId, diretoriaSigla);
        List<ContractPlan> plans = pcaId != null
                ? contractPlanRepository.findByPcaIdAndIsDeletedFalse(pcaId)
                : contractPlanRepository.findByIsDeletedFalse();

        populateTransientFieldsBulk(plans);
        populateLastUserNotesBulk(plans);

        if (status != null) {
            plans = plans.stream().filter(p -> status.equals(p.getStatus())).toList();
        }
        if (diretoriaSigla != null) {
            plans = plans.stream().filter(p -> diretoriaSigla.equals(p.getAreaSigla())).toList();
        }
        return plans;
    }

    public ContractPlan findById(Long id, Long userId) {
        ContractPlan plan = contractPlanRepository.findById(id)
                .filter(p -> !p.getIsDeleted())
                .orElseThrow(() -> new ApiException(404, "Plano de contratação não encontrado"));
        populateTransientFields(plan);
        validateAccess(userId, plan.getAreaSigla());
        return plan;
    }

    @Transactional
    public ContractPlan create(CreateContractPlanRequest req, Long userId) {
        validateAccess(userId, null);
        Pca pca = pcaCoreService.findOrCreate(req.pcaCode(), req.pcaYear(), userId);
        pca.setStatus(Pca.PcaStatusEnum.EM_ANDAMENTO);

        ContractPlan plan = new ContractPlan();
        plan.setPca(pca);
        plan.setObjectName(req.objectName() != null ? req.objectName() : "Sem Objeto / Novo Planejamento");
        plan.setCadastrosAreasId(req.cadastrosAreasId());
        plan.setCadastrosUnidadesId(req.cadastrosUnidadesId());
        plan.setDescription(req.description() != null ? req.description() : "");
        plan.setJustification(req.justification() != null ? req.justification() : "");
        plan.setEstimatedValueCents(req.estimatedValueCents() != null ? req.estimatedValueCents() : 0L);
        plan.setPriorityLevel(req.priorityLevel());
        LocalDate parsedDate = parseFlexibleDate(req.estimatedDate());
        plan.setEstimatedDate(parsedDate != null ? parsedDate : LocalDate.now());
        plan.setLoaReference(req.loaReference() != null ? req.loaReference() : "");
        plan.setProadNumber(req.proadNumber());
        plan.setSituation("Em Instrução");
        plan.setCreatedAt(LocalDateTime.now());
        plan.setCreatedBy(userId);

        plan = contractPlanRepository.save(plan);

        // Adicionar nota de criação
        String ipcStr = plan.getIpcCode() != null ? plan.getIpcCode() : "IPC-" + (pca.getYear() != null ? pca.getYear() : "2026") + "-00" + plan.getId();
        ContractPlanNote note = new ContractPlanNote();
        note.setContractPlan(plan);
        note.setUserId(userId);
        note.setIsSystemEvent(true);
        note.setCreatedBy(resolveUserName(userId));
        note.setMessage(ipcStr + " criada e submetida à CCA.");
        note.setCreatedAt(LocalDateTime.now());
        noteRepository.save(note);

        return populateTransientFields(plan);
    }

    @Transactional
    public ContractPlan update(Long id, UpdateContractPlanRequest req, Long userId) {
        ContractPlan plan = findById(id, userId);
        validateAccess(userId, plan.getAreaSigla());

        if (req.objectName() != null) plan.setObjectName(req.objectName());
        if (req.cadastrosAreasId() != null) plan.setCadastrosAreasId(req.cadastrosAreasId());
        if (req.cadastrosUnidadesId() != null) plan.setCadastrosUnidadesId(req.cadastrosUnidadesId());
        if (req.description() != null) plan.setDescription(req.description());
        if (req.justification() != null) plan.setJustification(req.justification());
        if (req.estimatedValueCents() != null) plan.setEstimatedValueCents(req.estimatedValueCents());
        if (req.priorityLevel() != null) plan.setPriorityLevel(req.priorityLevel());
        if (req.estimatedDate() != null) {
            LocalDate parsedDate = parseFlexibleDate(req.estimatedDate());
            if (parsedDate != null) plan.setEstimatedDate(parsedDate);
        }
        if (req.loaReference() != null) plan.setLoaReference(req.loaReference());
        if (req.situation() != null) {
            if (!VALID_SITUATIONS.contains(req.situation())) {
                throw new ApiException(400, "Situação inválida. Valores aceitos: " + VALID_SITUATIONS);
            }
            plan.setSituation(req.situation());
        }

        plan.setUpdatedAt(LocalDateTime.now());
        plan.setUpdatedBy(userId);

        plan = contractPlanRepository.save(plan);
        return populateTransientFields(plan);
    }

    @Transactional
    public ContractPlan updateStatus(Long id, int status, Long userId) {
        ContractPlan plan = findById(id, userId);
        plan.setStatus(status);
        plan.setUpdatedAt(LocalDateTime.now());
        plan.setUpdatedBy(userId);
        return contractPlanRepository.save(plan);
    }

    @Transactional
    public ContractPlan updateStep(Long id, int step, Long userId) {
        ContractPlan plan = findById(id, userId);
        plan.setStep(step);
        plan.setStepUpdatedAt(LocalDateTime.now());
        plan.setUpdatedAt(LocalDateTime.now());
        plan.setUpdatedBy(userId);
        return contractPlanRepository.save(plan);
    }



    @Transactional
    public void softDelete(Long id, Long userId) {
        ContractPlan plan = findById(id, userId);
        if (!plan.getContracts().isEmpty()) {
            throw new ApiException(400, "Não é possível excluir um plano que possui contratos vinculados.");
        }
        plan.setIsDeleted(true);
        plan.setDeletedAt(LocalDateTime.now());
        plan.setDeletedBy(userId);
        contractPlanRepository.save(plan);
    }

    // ============================================================
    // Membros (papéis / assinantes do DOD)
    // ============================================================

    public List<ContractPlanMember> findMembers(Long planId) {
        return memberRepository.findByContractPlanId(planId);
    }

    @Transactional
    public ContractPlanMember addMember(Long planId, Long userId, Long memberUserId, String role) {
        ContractPlan plan = findById(planId, userId);
        if (!VALID_MEMBER_ROLES.contains(role)) {
            throw new ApiException(400, "Role inválida. Aceitas: " + VALID_MEMBER_ROLES);
        }

        ContractPlanMember member = ContractPlanMember.builder()
                .contractPlan(plan)
                .userId(memberUserId)
                .role(role)
                .signatureStatus("PENDING")
                .createdAt(LocalDateTime.now())
                .createdBy(userId)
                .build();
        return memberRepository.save(member);
    }

    @Transactional
    public void removeMember(Long planId, Long memberId, Long userId) {
        findById(planId, userId); // valida acesso
        memberRepository.deleteById(memberId);
    }

    // ============================================================
    // Anexos (documentos categorizados — S3 + banco)
    // ============================================================

    public List<ContractPlanAttachment> findAttachments(Long planId) {
        return attachmentRepository.findByContractPlanIdAndIsDeletedFalse(planId);
    }

    public List<ContractPlanAttachment> findAttachmentsByType(Long planId, String documentType) {
        return attachmentRepository.findByContractPlanIdAndDocumentTypeAndIsDeletedFalse(planId, documentType);
    }

    /**
     * Upload de anexo: S3 primeiro, banco depois (com compensação).
     * Segue o padrão de {@link AtaComiteService#registrar}.
     */
    @Transactional
    public ContractPlanAttachment uploadAttachment(Long planId, Long userId, String documentType,
                                                    String originalFilename, String contentType,
                                                    long fileSize, InputStream stream) {
        ContractPlan plan = findById(planId, userId);

        if (!VALID_DOCUMENT_TYPES.contains(documentType)) {
            throw new ApiException(400, "Tipo de documento inválido. Aceitos: " + VALID_DOCUMENT_TYPES);
        }

        storageService.validarArquivo(originalFilename, fileSize);
        String fileKey = storageService.uploadContractPlan(planId, documentType, originalFilename, contentType, fileSize, stream);

        try {
            ContractPlanAttachment attachment = ContractPlanAttachment.builder()
                    .contractPlan(plan)
                    .fileName(originalFilename)
                    .fileKey(fileKey)
                    .fileSize(fileSize)
                    .contentType(contentType)
                    .documentType(documentType)
                    .uploadedBy(userId)
                    .uploadedAt(LocalDateTime.now())
                    .build();
            attachment = attachmentRepository.save(attachment);
            
            String userName = resolveUserName(userId);

            // Adicionar nota
            ContractPlanNote note = new ContractPlanNote();
            note.setContractPlan(plan);
            note.setUserId(userId);
            note.setIsSystemEvent(true);
            note.setCreatedBy(userName);
            note.setMessage("Arquivo '" + originalFilename + "' foi anexado.");
            note.setCreatedAt(LocalDateTime.now());
            noteRepository.save(note);
            
            return attachment;
        } catch (Exception ex) {
            // COMPENSAÇÃO: rollback S3
            try {
                storageService.delete(fileKey);
                log.warn("[ContractPlan] Compensação S3: '{}' removido após falha no banco", fileKey);
            } catch (Exception s3ex) {
                log.error("[ContractPlan] FALHA na compensação S3 para key '{}': {}", fileKey, s3ex.getMessage());
            }
            throw ex;
        }
    }

    public InputStream downloadAttachment(Long planId, Long attachmentId, Long userId) {
        findById(planId, userId);
        ContractPlanAttachment att = attachmentRepository.findById(attachmentId)
                .filter(a -> !a.getIsDeleted())
                .orElseThrow(() -> new ApiException(404, "Anexo não encontrado"));
        return storageService.download(att.getFileKey());
    }

    @Transactional
    public ContractPlanAttachment updateAttachmentType(Long planId, Long attachmentId, String newDocumentType, Long userId) {
        ContractPlan plan = findById(planId, userId);
        ContractPlanAttachment att = attachmentRepository.findById(attachmentId)
                .filter(a -> !a.getIsDeleted())
                .orElseThrow(() -> new ApiException(404, "Anexo não encontrado"));

        String normalizedDocType = newDocumentType != null ? newDocumentType.toLowerCase() : "";
        if (!VALID_DOCUMENT_TYPES.contains(normalizedDocType)) {
            throw new ApiException(400, "Tipo de documento inválido. Aceitos: " + VALID_DOCUMENT_TYPES);
        }

        att.setDocumentType(normalizedDocType);
        
        String userName = resolveUserName(userId);
        
        ContractPlanNote note = new ContractPlanNote();
        note.setContractPlan(plan);
        note.setUserId(userId);
        note.setIsSystemEvent(true);
        note.setCreatedBy(userName);
        note.setMessage("Tipo do anexo '" + att.getFileName() + "' foi alterado para " + normalizedDocType + ".");
        note.setCreatedAt(LocalDateTime.now());
        noteRepository.save(note);

        return attachmentRepository.save(att);
    }

    @Transactional
    public void softDeleteAttachment(Long planId, Long attachmentId, Long userId) {
        ContractPlan plan = findById(planId, userId);
        ContractPlanAttachment att = attachmentRepository.findById(attachmentId)
                .filter(a -> !a.getIsDeleted())
                .orElseThrow(() -> new ApiException(404, "Anexo não encontrado"));
        att.setIsDeleted(true);
        att.setDeletedAt(LocalDateTime.now());
        att.setDeletedBy(userId);
        attachmentRepository.save(att);
        
        String userName = resolveUserName(userId);

        // Adicionar nota
        ContractPlanNote note = new ContractPlanNote();
        note.setContractPlan(plan);
        note.setUserId(userId);
        note.setIsSystemEvent(true);
        note.setCreatedBy(userName);
        note.setMessage("Arquivo '" + att.getFileName() + "' foi removido.");
        note.setCreatedAt(LocalDateTime.now());
        noteRepository.save(note);
    }
    
    // --- Notas (Interlocução) ---
    
    public List<ContractPlanNote> getNotes(Long planId, Long userId) {
        findById(planId, userId); // Valida acesso e existência
        return noteRepository.findByContractPlanIdOrderByCreatedAtAsc(planId);
    }
    
    @Transactional
    public ContractPlanNote addNote(Long planId, String message, String location, Long userId) {
        if (message != null && message.length() > 300) {
            throw new ApiException(400, "O recado excede o limite de 300 caracteres.");
        }
        if (location != null && location.length() > 100) {
            throw new ApiException(400, "A localização excede o limite de 100 caracteres.");
        }

        ContractPlan plan = findById(planId, userId);
        
        String userName = resolveUserName(userId);

        ContractPlanNote note = new ContractPlanNote();
        note.setContractPlan(plan);
        note.setUserId(userId);
        note.setMessage(message);
        note.setLocation(location);
        note.setIsSystemEvent(false);
        note.setCreatedAt(LocalDateTime.now());
        note.setCreatedBy(userName);
        return noteRepository.save(note);
    }
    
    @Transactional
    public void deleteNote(Long planId, Long noteId, Long userId) {
        findById(planId, userId);
        ContractPlanNote note = noteRepository.findById(noteId)
                .orElseThrow(() -> new ApiException(404, "Nota não encontrada"));
        
        if (note.getIsSystemEvent()) {
            throw new ApiException(400, "Eventos do sistema não podem ser apagados");
        }
        
        note.setIsDeleted(true);
        note.setDeletedAt(LocalDateTime.now());
        note.setDeletedBy(String.valueOf(userId));
        noteRepository.save(note);
    }
}
