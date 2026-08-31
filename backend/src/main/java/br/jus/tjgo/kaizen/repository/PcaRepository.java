package br.jus.tjgo.kaizen.repository;

import br.jus.tjgo.kaizen.domain.Pca;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PcaRepository extends JpaRepository<Pca, Long> {
    Optional<Pca> findByCodeAndYearAndIsDeletedFalse(String code, String year);

    @Query("SELECT p.year FROM Pca p WHERE p.id = :id")
    String findYearById(@Param("id") Long id);

    @Modifying
    @Query("UPDATE Pca p SET p.status = 'EM_ANDAMENTO' WHERE p.id = :id")
    void updateStatusToEmAndamento(@Param("id") Long id);
}
