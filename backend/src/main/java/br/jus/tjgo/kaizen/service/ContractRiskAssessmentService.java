package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.domain.ContractRiskAssessment;
import br.jus.tjgo.kaizen.domain.ContractRiskAssessmentStatus;
import br.jus.tjgo.kaizen.integration.gemini.GeminiIntegrationService;
import br.jus.tjgo.kaizen.integration.gemini.dto.AnexoDTO;
import br.jus.tjgo.kaizen.integration.gemini.dto.GeminiResponseDTO;
import br.jus.tjgo.kaizen.repository.ContractRiskAssessmentRepository;
import br.jus.tjgo.kaizen.repository.ContractRiskAssessmentValidationRepository;
import br.jus.tjgo.kaizen.domain.ContractRiskAssessmentValidation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.OffsetDateTime;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContractRiskAssessmentService {

    private final ContractRiskAssessmentRepository repository;
    private final ContractRiskAssessmentValidationRepository validationRepository;
    private final GeminiIntegrationService geminiIntegrationService;

    @Transactional
    public ContractRiskAssessment startcontractRiskAssessment(Long userId, String apiToken, MultipartFile dod,
            MultipartFile etp, MultipartFile tr) {
        if (repository.existsByCreatedByIdAndStatus(userId, ContractRiskAssessmentStatus.IN_PROGRESS)) {
            throw new IllegalStateException("You already have an contractRiskAssessment in progress.");
        }

        ContractRiskAssessment contractRiskAssessment = ContractRiskAssessment.builder()
                .createdById(userId)
                .status(ContractRiskAssessmentStatus.IN_PROGRESS)
                .build();

        return repository.save(contractRiskAssessment);
    }

    @Async
    @Transactional
    public void processcontractRiskAssessment(Long contractRiskAssessmentId, String apiToken, List<AnexoDTO> anexos) {
        try {

            String prompt = """
                    Você é um Analista de Riscos Sênior do TJGO, especialista em contratações de TIC e normas ISO 31000.
                    Sua missão é extrair informações estratégicas e mapear riscos técnicos de forma abrangente e precisa.
                    Evite riscos com nível de similaridade alto, agrupe causas e consequências em um único evento de risco.
                    Evite usar "e" ou "ou" na definição do evento de risco. Tenha linguagem objetiva e com atomicidade nas sentenças.
                    Analise os arquivos DOD, ETP e TR em anexo e gere uma avaliacao de riscos em formato JSON estrito,
                    sem markdown, contendo exatamente a seguinte estrutura:
                    {
                      "titulo": "Nome da Contratacao extraido dos documentos",
                      "objetivos": ["Objetivo 1", "Objetivo 2"],
                      "riscos": [
                        {
                          "evento": "Descricao do evento de risco",
                          "causas": ["Causa 1", "Causa 2"],
                          "consequencias": ["Consequencia 1"],
                          "probabilidade": 2, // (Valores: 2, 4, 6, 8, 10) 2 = Muito Baixa, 10 = Muito Alta
                          "impacto": 4, // (Valores: 2, 4, 6, 8, 10) 2 = Insignificante, 10 = Extremo
                          "controles": ["Controle Existente 1"],
                          "nivel_controle": 60 // (Valores: 100, 80, 60, 40, 20) 100 = Inexistente, 20 = Forte
                        }
                      ]
                    }
                    """;

            log.info("Enviando avaliacao de riscos para o Gemini (ID: {})", contractRiskAssessmentId);
            GeminiResponseDTO responseDTO = geminiIntegrationService.processarPrompt(apiToken, null, prompt, anexos);

            // Remove markdown code blocks if the model returned them
            String responseJson = responseDTO.resposta().replaceAll("(?s)^```json\\s*(.*?)\\s*```$", "$1").trim();
            responseJson = responseJson.replaceAll("(?s)^```\\s*(.*?)\\s*```$", "$1").trim();

            ContractRiskAssessment contractRiskAssessment = repository.findById(contractRiskAssessmentId)
                    .orElseThrow(() -> new IllegalArgumentException("contractRiskAssessment not found"));

            contractRiskAssessment.setBody(responseJson);
            contractRiskAssessment.setStatus(ContractRiskAssessmentStatus.COMPLETED);
            repository.save(contractRiskAssessment);

        } catch (Exception e) {
            log.error("Error processing risk contractRiskAssessment ID: " + contractRiskAssessmentId, e);
            repository.findById(contractRiskAssessmentId).ifPresent(contractRiskAssessment -> {
                contractRiskAssessment.setStatus(ContractRiskAssessmentStatus.ERROR);
                repository.save(contractRiskAssessment);
            });
        }
    }

    public Page<ContractRiskAssessment> listcontractRiskAssessments(Long userId, String search, int page, int size) {
        return repository.findBySearchOrderByCreatedAtDesc(search, PageRequest.of(page, size));
    }

    public Optional<ContractRiskAssessment> getcontractRiskAssessment(Long id, Long userId) {
        return repository.findById(id).map(assessment -> {
            assessment.setHasPreviousValidation(validationRepository.existsByAssessmentId(id));
            return assessment;
        });
    }

    @Transactional
    public void deletecontractRiskAssessment(Long id, Long userId) {
        getcontractRiskAssessment(id, userId).ifPresent(repository::delete);
    }

    @Transactional
    public void updatecontractRiskAssessmentBody(Long id, Long userId, String newBody) {
        getcontractRiskAssessment(id, userId).ifPresent(contractRiskAssessment -> {
            contractRiskAssessment.setBody(newBody);
            contractRiskAssessment.setUpdatedById(userId);
            contractRiskAssessment.setValidatedAt(null);
            contractRiskAssessment.setValidatedById(null);
            repository.save(contractRiskAssessment);
        });
    }

    @Transactional
    public ContractRiskAssessment createManualAssessment(Long userId, String body) {
        ContractRiskAssessment assessment = ContractRiskAssessment.builder()
                .createdById(userId)
                .status(ContractRiskAssessmentStatus.COMPLETED)
                .body(body)
                .build();
        return repository.save(assessment);
    }

    @Transactional
    public void validateAssessment(Long id, Long userId) {
        repository.findById(id).ifPresent(assessment -> {
            OffsetDateTime now = OffsetDateTime.now();
            assessment.setValidatedAt(now);
            assessment.setValidatedById(userId);
            repository.save(assessment);

            ContractRiskAssessmentValidation validation = ContractRiskAssessmentValidation.builder()
                    .assessmentId(id)
                    .body(assessment.getBody())
                    .validatedById(userId)
                    .validatedAt(now)
                    .build();
            validationRepository.save(validation);
        });
    }

    @Transactional
    public void recoverValidation(Long id, Long userId) {
        validationRepository.findFirstByAssessmentIdOrderByValidatedAtDesc(id).ifPresent(validation -> {
            repository.findById(id).ifPresent(assessment -> {
                assessment.setBody(validation.getBody());
                assessment.setValidatedAt(validation.getValidatedAt());
                assessment.setValidatedById(validation.getValidatedById());
                assessment.setUpdatedById(userId);
                repository.save(assessment);
            });
        });
    }
}
