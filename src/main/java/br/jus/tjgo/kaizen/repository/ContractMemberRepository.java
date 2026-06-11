package br.jus.tjgo.kaizen.repository;

import br.jus.tjgo.kaizen.domain.ContractMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ContractMemberRepository extends JpaRepository<ContractMember, Long> {
}
