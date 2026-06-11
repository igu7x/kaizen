package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.domain.Pca;
import br.jus.tjgo.kaizen.exception.ApiException;
import br.jus.tjgo.kaizen.repository.PcaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PcaCoreService {

    private final PcaRepository pcaRepository;

    public List<Pca> findAll() {
        return pcaRepository.findAll().stream().filter(p -> !p.getIsDeleted()).toList();
    }

    public Pca findById(Long id) {
        return pcaRepository.findById(id)
                .filter(p -> !p.getIsDeleted())
                .orElseThrow(() -> new ApiException(404, "PCA não encontrado"));
    }

    @Transactional
    public Pca findOrCreate(String code, String year, Long userId) {
        return pcaRepository.findByCodeAndYearAndIsDeletedFalse(code, year)
                .orElseGet(() -> {
                    Pca newPca = new Pca();
                    newPca.setCode(code);
                    newPca.setYear(year);
                    newPca.setCreatedAt(LocalDateTime.now());
                    newPca.setCreatedBy(userId);
                    return pcaRepository.save(newPca);
                });
    }

    @Transactional
    public void softDelete(Long id, Long userId) {
        Pca pca = findById(id);
        if (!pca.getContractPlans().isEmpty()) {
            throw new ApiException(400, "Não é possível excluir um PCA que possui planos de contratação vinculados.");
        }
        pca.setIsDeleted(true);
        pca.setDeletedAt(LocalDateTime.now());
        pca.setDeletedBy(userId);
        pcaRepository.save(pca);
    }
}
