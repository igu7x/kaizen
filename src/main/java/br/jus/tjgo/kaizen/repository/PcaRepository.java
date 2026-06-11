package br.jus.tjgo.kaizen.repository;

import br.jus.tjgo.kaizen.domain.Pca;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PcaRepository extends JpaRepository<Pca, Long> {
    Optional<Pca> findByCodeAndYearAndIsDeletedFalse(String code, String year);
}
