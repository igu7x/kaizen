package br.jus.tjgo.kaizen.repository;

import br.jus.tjgo.kaizen.domain.ContractPlanMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ContractPlanMemberRepository extends JpaRepository<ContractPlanMember, Long> {

    List<ContractPlanMember> findByContractPlanId(Long contractPlanId);

    List<ContractPlanMember> findByContractPlanIdAndRole(Long contractPlanId, String role);
}
