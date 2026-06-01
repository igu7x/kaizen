import jsPDF from 'jspdf';
import { LOGO_BRANCO_4K_BASE64 } from './logoBranco4kBase64';
import type { AutoavaliacaoFormulario } from '@/services/autoavaliacaoApi';

// Paleta — design unificado dos PDFs
const BLUE_DARK = [10, 35, 81] as const;
const BLUE_MEDIUM = [30, 70, 140] as const;
const BLUE_TITLE_BG = [219, 234, 254] as const;
const HEADER_BLOCK_BG = [241, 245, 249] as const;
const BORDER_GRAY = [203, 213, 225] as const;
const LABEL_GRAY = [55, 65, 81] as const;
const TEXT_GRAY = [31, 41, 55] as const;
const MUTED_GRAY = [107, 114, 128] as const;
const ACCENT_ORANGE = [249, 115, 22] as const;
const WHITE = [255, 255, 255] as const;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = PAGE_HEIGHT - 15;

const NOTA_LABELS: Record<string, Record<number, string>> = {
  tecnica: { 1: '1 — Iniciante', 2: '2 — Básico', 3: '3 — Intermediário', 4: '4 — Avançado', 5: '5 — Especialista' },
  comportamental: { 1: '1 — Não demonstra', 2: '2 — Em desenvolvimento', 3: '3 — Adequado', 4: '4 — Destaque', 5: '5 — Referência' },
  estrategica: { 1: '1 — Compreensão Limitada', 2: '2 — Em Desenvolvimento', 3: '3 — Alinhado', 4: '4 — Contribui Ativamente', 5: '5 — Referência' },
  gerencial: { 1: '1 — Compreensão Limitada', 2: '2 — Em Desenvolvimento', 3: '3 — Alinhado', 4: '4 — Contribui Ativamente', 5: '5 — Referência' },
};

function formatDate(d: string): string {
  try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

function addFooter(doc: jsPDF, pg: number, total: number, label: string) {
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED_GRAY);
  doc.text(label, MARGIN_LEFT, FOOTER_Y, { maxWidth: CONTENT_WIDTH - 40 });
  doc.text(`Página ${pg} de ${total}`, PAGE_WIDTH - MARGIN_RIGHT, FOOTER_Y, { align: 'right' });
}

function drawSectionTitleBar(doc: jsPDF, title: string, y: number): number {
  const h = 14;
  const upperText = title.toUpperCase();
  const decorY = y + h / 2;
  const centerX = MARGIN_LEFT + CONTENT_WIDTH / 2;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE_DARK);
  const textWidth = doc.getTextWidth(upperText);

  doc.setDrawColor(...BLUE_DARK);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT + 6, decorY, centerX - textWidth / 2 - 5, decorY);
  doc.line(centerX + textWidth / 2 + 5, decorY, MARGIN_LEFT + CONTENT_WIDTH - 6, decorY);

  doc.setFillColor(...BLUE_DARK);
  doc.circle(MARGIN_LEFT + 3, decorY, 1.5, 'F');
  doc.circle(MARGIN_LEFT + CONTENT_WIDTH - 3, decorY, 1.5, 'F');

  doc.text(upperText, centerX, decorY + 1.5, { align: 'center' });

  return y + h + 4;
}

function drawValidationBlock(
  doc: jsPDF,
  items: Array<{ label: string; value: string }>,
  headerLabel: string,
  y: number,
): number {
  if (items.length === 0) return y;
  const headerH = 9;
  const rowH = 9;
  const totalH = headerH + items.length * rowH;
  const labelColW = 60;

  doc.setFillColor(...HEADER_BLOCK_BG);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, headerH, 'F');
  doc.setFillColor(...BLUE_DARK);
  doc.rect(MARGIN_LEFT + 3, y + 2, 1.5, headerH - 4, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE_DARK);
  doc.text(headerLabel, MARGIN_LEFT + 8, y + 6);

  let rowY = y + headerH;
  for (const item of items) {
    doc.setFillColor(...WHITE);
    doc.rect(MARGIN_LEFT, rowY, CONTENT_WIDTH, rowH, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...LABEL_GRAY);
    doc.text(item.label, MARGIN_LEFT + 4, rowY + 5.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_GRAY);
    const valueText = doc.splitTextToSize(item.value, CONTENT_WIDTH - labelColW - 8);
    doc.text(valueText[0] || '', MARGIN_LEFT + labelColW + 4, rowY + 5.8);

    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_LEFT, rowY, MARGIN_LEFT + CONTENT_WIDTH, rowY);
    doc.line(MARGIN_LEFT + labelColW, rowY, MARGIN_LEFT + labelColW, rowY + rowH);

    rowY += rowH;
  }

  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, totalH, 'S');
  doc.line(MARGIN_LEFT, y + headerH, MARGIN_LEFT + CONTENT_WIDTH, y + headerH);

  return y + totalH + 6;
}

// Card de competência avaliada — header azul (número + nome) e body branco com
// nota destacada e (opcional) descrição/comentário.
function drawAvaliacaoCard(
  doc: jsPDF,
  options: {
    numero: number;
    nome: string;
    descricao?: string;
    notaLabel: string;
    comentario?: string;
    y: number;
  },
): number {
  const { numero, nome, descricao, notaLabel, comentario } = options;
  let y = options.y;

  const headerH = 10;
  const numberSquareW = 12;

  // Header
  doc.setFillColor(...BLUE_DARK);
  doc.rect(MARGIN_LEFT, y, numberSquareW, headerH, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text(String(numero), MARGIN_LEFT + numberSquareW / 2, y + 7, { align: 'center' });

  doc.setFillColor(...BLUE_MEDIUM);
  doc.rect(MARGIN_LEFT + numberSquareW, y, CONTENT_WIDTH - numberSquareW, headerH, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  const nameLines = doc.splitTextToSize(nome, CONTENT_WIDTH - numberSquareW - 6);
  doc.text(nameLines[0] || '', MARGIN_LEFT + numberSquareW + 3, y + 6.5);

  y += headerH;

  // Linha "Nota"
  const labelColW = 32;
  const notaRowH = 9;
  doc.setFillColor(...WHITE);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, notaRowH, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...LABEL_GRAY);
  doc.text('Nota', MARGIN_LEFT + 4, y + 5.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE_DARK);
  doc.text(notaLabel, MARGIN_LEFT + labelColW + 4, y + 5.8);
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, notaRowH, 'S');
  doc.line(MARGIN_LEFT + labelColW, y, MARGIN_LEFT + labelColW, y + notaRowH);
  y += notaRowH;

  // Descrição (se houver)
  if (descricao) {
    const descLines = doc.splitTextToSize(descricao, CONTENT_WIDTH - labelColW - 8);
    const descH = Math.max(notaRowH, descLines.length * 4.3 + 3);
    doc.setFillColor(...WHITE);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, descH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...LABEL_GRAY);
    doc.text('Descrição', MARGIN_LEFT + 4, y + 5.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_GRAY);
    doc.text(descLines, MARGIN_LEFT + labelColW + 4, y + 5.8);
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, descH, 'S');
    doc.line(MARGIN_LEFT + labelColW, y, MARGIN_LEFT + labelColW, y + descH);
    y += descH;
  }

  // Comentário (se houver)
  if (comentario) {
    const comLines = doc.splitTextToSize(comentario, CONTENT_WIDTH - labelColW - 8);
    const comH = Math.max(notaRowH, comLines.length * 4.3 + 3);
    doc.setFillColor(...WHITE);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, comH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...LABEL_GRAY);
    doc.text('Comentário', MARGIN_LEFT + 4, y + 5.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_GRAY);
    doc.text(comLines, MARGIN_LEFT + labelColW + 4, y + 5.8);
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, comH, 'S');
    doc.line(MARGIN_LEFT + labelColW, y, MARGIN_LEFT + labelColW, y + comH);
    y += comH;
  }

  return y + 5;
}

function pageBreak(doc: jsPDF, y: number, need: number): number {
  if (y + need > FOOTER_Y - 5) { doc.addPage(); return 20; }
  return y;
}

export function generateAutoavaliacaoPDF(formulario: AutoavaliacaoFormulario) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = 0;

  const tipoInv = formulario.tipo_inventario || 'equipe';
  const tipoLabel = tipoInv === 'gestor' ? 'Inventário do Gestor' : 'Inventário da Equipe';

  // ============================================================
  // HEADER (mantido)
  // ============================================================
  const headerH = 55;
  for (let i = 0; i < PAGE_WIDTH; i++) {
    const t = i / (PAGE_WIDTH - 1);
    doc.setFillColor(Math.round(10 + 20 * t), Math.round(35 + 35 * t), Math.round(81 + 59 * t));
    doc.rect(i, 0, 2, headerH, 'F');
  }
  const leftMaxW = PAGE_WIDTH * 0.6 - (MARGIN_LEFT + 5) - 4;
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text('Autoavaliação do Colaborador', MARGIN_LEFT + 5, 18, { maxWidth: leftMaxW });
  doc.setFontSize(12); doc.setFont('helvetica', 'normal');
  doc.text(tipoLabel, MARGIN_LEFT + 5, 27, { maxWidth: leftMaxW });
  doc.setFontSize(10); doc.setTextColor(200, 210, 230);
  const lot = `${formulario.diretoria || ''}${formulario.unidade_nome ? ': ' + formulario.unidade_nome : ''}`;
  const lotLines = doc.splitTextToSize(lot, leftMaxW);
  doc.text(lotLines, MARGIN_LEFT + 5, 36);
  const lotEndY = 36 + (lotLines.length - 1) * 4;
  doc.setFontSize(9); doc.setTextColor(180, 195, 220);
  const colabText = `Colaborador: ${formulario.nome_completo || formulario.user_name || ''}`;
  doc.text(doc.splitTextToSize(colabText, leftMaxW), MARGIN_LEFT + 5, lotEndY + 8);

  // Logo
  const rcx = PAGE_WIDTH * 0.6 + (PAGE_WIDTH * 0.4) / 2;
  doc.addImage(LOGO_BRANCO_4K_BASE64, 'PNG', rcx - 9, 10, 18, 22, undefined, 'FAST');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text('PODER JUDICIÁRIO', rcx, 37, { align: 'center' });
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
  doc.text('Tribunal de Justiça do Estado de Goiás', rcx, 43, { align: 'center' });

  y = headerH + 8;

  // ============================================================
  // BLOCO - Dados do Colaborador
  // ============================================================
  const dadosItems: Array<{ label: string; value: string }> = [
    { label: 'Nome', value: formulario.nome_completo || '' },
    { label: 'Matrícula', value: formulario.matricula || '' },
    { label: 'Cargo/Função', value: formulario.cargo_funcao || '' },
    { label: 'E-mail', value: formulario.email_institucional || '' },
  ];
  if (formulario.validado_por_nome) {
    dadosItems.push({
      label: 'Validado em',
      value: `${formulario.validado_por_nome} — ${formulario.validado_em ? formatDate(formulario.validado_em) : ''}`,
    });
  }
  y = drawValidationBlock(doc, dadosItems, 'Dados do Colaborador', y);

  // ============================================================
  // COMPETÊNCIAS (por seção)
  // ============================================================
  const respostas = formulario.respostas || [];
  const tiposSecao: { tipo: string; titulo: string }[] = [
    { tipo: 'tecnica', titulo: 'Competências Técnicas' },
    { tipo: 'comportamental', titulo: 'Competências Comportamentais' },
  ];
  if (tipoInv === 'gestor') {
    tiposSecao.push(
      { tipo: 'estrategica', titulo: 'Competências Estratégicas' },
      { tipo: 'gerencial', titulo: 'Competências Gerenciais' },
    );
  }

  for (const secao of tiposSecao) {
    const rs = respostas.filter(r => (r.tipo || 'tecnica') === secao.tipo);
    if (rs.length === 0) continue;

    y = pageBreak(doc, y, 24);
    y = drawSectionTitleBar(doc, `${secao.titulo} (${rs.length})`, y);

    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      doc.setFontSize(9.5);
      const linesEstim = doc.splitTextToSize((r.competencia_descricao || '') + (r.comentario || ''), CONTENT_WIDTH - 40);
      const estimatedH = 10 + 9 + linesEstim.length * 4.5 + 12;
      y = pageBreak(doc, y, estimatedH);

      const labels = NOTA_LABELS[r.tipo || secao.tipo] || NOTA_LABELS.tecnica;
      y = drawAvaliacaoCard(doc, {
        numero: i + 1,
        nome: r.competencia_nome,
        descricao: r.competencia_descricao || undefined,
        notaLabel: labels[r.nota] || `${r.nota}`,
        comentario: r.comentario || undefined,
        y,
      });
    }
  }

  // FOOTER em todas as páginas (sem data/hora — refletindo só identificação e versão)
  const versionPart = formulario.versao_formulario && formulario.versao_formulario > 0 ? `Versão ${formulario.versao_formulario}.0` : '';
  const footerLabel = ['Autoavaliação', formulario.unidade_nome || '', versionPart].filter(Boolean).join(' — ');

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(doc, p, totalPages, footerLabel);
  }

  const blobUrl = doc.output('bloburl');
  window.open(blobUrl as unknown as string, '_blank');
}
