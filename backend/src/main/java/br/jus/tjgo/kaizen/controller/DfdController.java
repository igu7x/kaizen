package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.dto.DfdConsultaDto;
import br.jus.tjgo.kaizen.service.DfdConsultaService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * DFD-Consulta (Orçamento de TIC, Cap. 1). Monta os 4 blocos derivados dos contratos continuada da
 * unidade + itens do PCA-TIC corrente. Somente leitura nesta etapa; persistência do IFO e envio à
 * CCA virão a seguir (RF-05.1/24/26).
 */
@RestController
@RequestMapping("/api/dfd")
@RequiredArgsConstructor
public class DfdController {

    private final DfdConsultaService service;

    // GET /api/dfd/consulta?ano=2026&unidadeId=12
    @GetMapping("/consulta")
    public DfdConsultaDto consulta(@RequestParam int ano,
                                   @RequestParam(value = "unidadeId", required = false) Long unidadeId) {
        return service.montarConsulta(ano, unidadeId);
    }
}
