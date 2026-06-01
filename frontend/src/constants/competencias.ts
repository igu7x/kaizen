// Constantes compartilhadas entre Autoavaliação, Avaliação do Gestor e Avaliação Integrada

/**
 * Quebra uma label de escala (ex.: "1 — Adequado: Apresenta o comportamento...")
 * em três partes — número, título e descrição — para render com negrito no
 * prefixo nas legendas e exibir a descrição como tooltip no radio.
 * Aceita travessão (—), meia-risca (–) e hífen (-).
 */
export function parseEscalaItem(label: string): { num: string; titulo: string; descricao: string } {
  const match = label.match(/^\s*(\d+)\s*[—–-]\s*([^:]+):\s*(.+)$/);
  if (!match) return { num: '', titulo: label, descricao: '' };
  return { num: match[1].trim(), titulo: match[2].trim(), descricao: match[3].trim() };
}

export const ESCALA_NOTAS = [
  { value: '1', label: '1 — Iniciante: Não exerce a competência ou a aplica apenas mediante orientação direta e contínua, sem autonomia para conduzir atividades técnicas da área.' },
  { value: '2', label: '2 — Básico: Exerce a competência em situações de rotina e baixa complexidade, com apoio de colegas mais experientes para lidar com variações ou imprevistos.' },
  { value: '3', label: '3 — Intermediário: Exerce a competência com autonomia nas situações usuais da área, conduz suas atividades técnicas sem supervisão direta e busca apoio apenas em casos não convencionais.' },
  { value: '4', label: '4 — Avançado: Resolve casos complexos ou atípicos, orienta os colegas na aplicação da competência e contribui para a evolução das práticas técnicas adotadas pela área.' },
  { value: '5', label: '5 — Especialista: Define padrões técnicos, propõe inovações, dissemina conhecimento e atua como referência institucional na competência, sendo procurado para apoiar decisões técnicas estratégicas.' },
];

export const ESCALA_COMPORTAMENTAL = [
  { value: '1', label: '1 — Não demonstra: Raramente apresenta o comportamento esperado, inclusive em situações de rotina, e sua ausência compromete o desempenho da equipe ou da unidade.' },
  { value: '2', label: '2 — Em desenvolvimento: Apresenta o comportamento de forma ocasional ou inconsistente, com variações que exigem acompanhamento e reforço para consolidação.' },
  { value: '3', label: '3 — Adequado: Apresenta o comportamento de forma regular nas situações comuns de trabalho, contribuindo de maneira estável para o ambiente e os resultados da equipe.' },
  { value: '4', label: '4 — Destaque: Sustenta o comportamento com consistência em situações complexas ou de maior exigência, servindo como ponto de apoio para colegas e pares em contextos desafiadores.' },
  { value: '5', label: '5 — Referência: É exemplo institucional do comportamento, influencia positivamente o ambiente de trabalho e promove sua disseminação entre colegas, equipes e pares em outras áreas.' },
];

export const ESCALA_ESTRATEGICA = [
  { value: '1', label: '1 — Compreensão Limitada: Atua sem clareza sobre as diretrizes institucionais e toma decisões predominantemente reativas ao contexto imediato.' },
  { value: '2', label: '2 — Em Desenvolvimento: Reconhece as orientações estratégicas, mas as aplica de forma pontual, dependendo de direcionamento superior para conectar suas entregas aos objetivos institucionais.' },
  { value: '3', label: '3 — Alinhado: Conduz as atividades da unidade de forma consistente com as prioridades institucionais, traduzindo diretrizes em ações concretas com autonomia.' },
  { value: '4', label: '4 — Contribui Ativamente: Antecipa implicações estratégicas, propõe iniciativas que ampliam os resultados institucionais e exerce influência sobre decisões além do escopo imediato da unidade.' },
  { value: '5', label: '5 — Referência: Atua como articulador institucional, orienta outras lideranças na aplicação da visão estratégica e promove mudanças que elevam o patamar de resultados da organização.' },
];

export const ESCALA_GERENCIAL = [
  { value: '1', label: '1 — Compreensão Limitada: Enfrenta dificuldades recorrentes na aplicação da competência e depende de intervenção superior para conduzir situações básicas de gestão.' },
  { value: '2', label: '2 — Em Desenvolvimento: Aplica a competência de forma incipiente, exige acompanhamento e orientação para lidar com situações de rotina e ainda não a exerce com autonomia.' },
  { value: '3', label: '3 — Alinhado: Aplica a competência com consistência nas situações usuais de gestão da unidade, conduzindo as atividades e a equipe com autonomia e obtendo os resultados esperados.' },
  { value: '4', label: '4 — Contribui Ativamente: Aplica a competência com segurança em contextos complexos ou de maior exigência, amplia os resultados da unidade e serve de apoio técnico-gerencial a pares e colaboradores.' },
  { value: '5', label: '5 — Referência: Atua como referência institucional na aplicação da competência, influencia práticas de gestão além de sua unidade e promove o aprimoramento contínuo dos processos gerenciais.' },
];

export const COMPETENCIAS_COMPORTAMENTAIS = [
  {
    nome: 'Trabalho em equipe',
    descricao: 'Atuar de forma cooperativa e respeitosa com colegas e pares, compartilhando informações e conhecimentos, somando esforços na solução de problemas e contribuindo para um ambiente de trabalho produtivo e colaborativo.',
  },
  {
    nome: 'Adaptabilidade',
    descricao: 'Ajustar-se a mudanças de prioridades, processos, tecnologias ou contextos de trabalho, preservando a qualidade das entregas e convertendo situações de transição em oportunidades de aprendizado e aprimoramento.',
  },
  {
    nome: 'Proatividade',
    descricao: 'Antecipar necessidades, identificar problemas latentes e agir preventivamente, mobilizando recursos e iniciativas para endereçar questões antes que comprometam resultados ou exijam intervenção superior.',
  },
  {
    nome: 'Integridade e Responsabilização',
    descricao: 'Conduzir-se conforme padrões éticos e institucionais, assumir responsabilidade pelas decisões e ações sob sua esfera de atuação, reconhecer erros com abertura e prestar contas de forma transparente aos pares, à equipe e às instâncias superiores.',
  },
  {
    nome: 'Resiliência',
    descricao: 'Manter equilíbrio, foco e desempenho diante de pressões, contratempos ou situações adversas, preservando a continuidade do trabalho e contribuindo para a estabilidade do ambiente em momentos de maior exigência.',
  },
];

export const COMPETENCIAS_ESTRATEGICAS = [
  {
    nome: 'Visão estratégica',
    descricao: 'Interpretar o contexto institucional e traduzir as prioridades do tribunal em direcionadores concretos para a sua atuação, antecipando tendências e conectando iniciativas da área aos objetivos de longo prazo.',
  },
  {
    nome: 'Governança e Planejamento',
    descricao: 'Conduzir o ciclo de planejamento, execução e monitoramento das iniciativas da área com base em práticas de governança, assegurando coerência com as diretrizes institucionais, conformidade com os normativos aplicáveis e aderência aos instrumentos de planejamento vigentes.',
  },
  {
    nome: 'Gestão de riscos',
    descricao: 'Identificar, avaliar e tratar riscos inerentes ao escopo de atuação, adotando controles proporcionais ao impacto potencial e assegurando a continuidade e a confiabilidade das entregas sob sua responsabilidade.',
  },
  {
    nome: 'Foco no usuário',
    descricao: 'Orientar as decisões e entregas a partir da compreensão das necessidades dos usuários internos e externos, priorizando a geração de valor, a qualidade da experiência e a efetividade dos serviços prestados.',
  },
  {
    nome: 'Inovação e melhoria contínua',
    descricao: 'Promover a revisão crítica de processos, práticas e soluções sob sua responsabilidade, estimulando a adoção de alternativas que ampliem eficiência, qualidade e resultados institucionais.',
  },
];

export const COMPETENCIAS_GERENCIAIS = [
  {
    nome: 'Gestão de Pessoas',
    descricao: 'Conduzir equipes com clareza de propósito, distribuindo responsabilidades, acompanhando o desempenho individual e coletivo, oferecendo orientação e retorno estruturado e promovendo o desenvolvimento profissional dos servidores em função das necessidades da unidade e da instituição.',
  },
  {
    nome: 'Articulação Institucional',
    descricao: 'Promover a cooperação com as demais áreas do tribunal, com ênfase naquelas de maior interação ou interdependência, construindo entendimentos que superem barreiras organizacionais, alinhando expectativas entre partes interessadas e conduzindo pactos que viabilizem entregas compartilhadas e a atuação integrada da instituição.',
  },
  {
    nome: 'Gestão de Projetos',
    descricao: 'Estruturar, conduzir e monitorar iniciativas sob sua responsabilidade, equilibrando escopo, prazos e recursos, antecipando obstáculos à execução e assegurando a entrega dos resultados pactuados em consonância com as prioridades institucionais.',
  },
  {
    nome: 'Gestão de Indicadores',
    descricao: 'Definir, acompanhar e interpretar indicadores de desempenho, convertendo dados em leituras consistentes sobre a execução das atividades e utilizando-os como base para decisões gerenciais e para a prestação de contas institucional.',
  },
  {
    nome: 'Gestão de Processos',
    descricao: 'Mapear, analisar e aprimorar os processos de trabalho sob responsabilidade da área, identificando gargalos, padronizando fluxos e promovendo ganhos de eficiência, qualidade e previsibilidade na execução das atividades recorrentes.',
  },
];

export const NOTA_TECNICA_LABELS: Record<number, string> = {
  1: 'Iniciante',
  2: 'Básico',
  3: 'Intermediário',
  4: 'Avançado',
  5: 'Especialista',
};

export const NOTA_COMPORTAMENTAL_LABELS: Record<number, string> = {
  1: 'Não demonstra',
  2: 'Em desenvolvimento',
  3: 'Adequado',
  4: 'Destaque',
  5: 'Referência',
};

export const NOTA_ESTRATEGICA_LABELS: Record<number, string> = {
  1: 'Compreensão Limitada',
  2: 'Em Desenvolvimento',
  3: 'Alinhado',
  4: 'Contribui Ativamente',
  5: 'Referência',
};

export const NOTA_GERENCIAL_LABELS: Record<number, string> = {
  1: 'Compreensão Limitada',
  2: 'Em Desenvolvimento',
  3: 'Alinhado',
  4: 'Contribui Ativamente',
  5: 'Referência',
};

export const NOTA_COLORS: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-blue-100 text-blue-700',
  5: 'bg-emerald-100 text-emerald-700',
};
