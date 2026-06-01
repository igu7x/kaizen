import jsPDF from 'jspdf';
import type { Projeto, Tep, Entrega } from '../services/contratosProjetosApi';
import { P_CENT_BASE64 } from './pCentBase64';

// ============================================================
// Paleta — TEP usa tom verde como identidade visual
// ============================================================
const TEXT_DARK = [15, 23, 42] as const;          // #0f172a
const ACCENT = [47, 107, 79] as const;            // #2F6B4F — verde principal institucional
const ACCENT_BG_LIGHT = [228, 242, 234] as const; // #E4F2EA — fundo claro harmonizado
const BORDER_GRAY = [203, 213, 225] as const;     // #cbd5e1
const LABEL_GRAY = [55, 65, 81] as const;         // #374151
const TEXT_GRAY = [31, 41, 55] as const;          // #1f2937
const MUTED_GRAY = [107, 114, 128] as const;      // #6b7280
const SUBTLE_GRAY = [100, 116, 139] as const;     // #64748b
const WHITE = [255, 255, 255] as const;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = PAGE_HEIGHT - 15;

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const raw = dateStr.substring(0, 10);
    const [year, month, day] = raw.split('-').map(Number);
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number, versao: number, tapId: string | null) {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED_GRAY);
  const idPart = tapId ? `  —  ID: ${tapId}` : '';
  doc.text(`TEP  —  Termo de Encerramento do Projeto  —  Versão ${versao}.0${idPart}`, MARGIN_LEFT, FOOTER_Y);
  doc.text(`Página ${pageNum} de ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, FOOTER_Y, { align: 'right' });
}

// Tamanhos padronizados pra match com o "Histórico de Validação" (título 10pt).
function drawNumberedSectionHeader(doc: jsPDF, numero: number, title: string, y: number): number {
  const h = 10;
  const numberSquareW = 12;

  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN_LEFT, y, numberSquareW, h, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text(String(numero), MARGIN_LEFT + numberSquareW / 2, y + 6.8, { align: 'center' });

  doc.setFillColor(...ACCENT_BG_LIGHT);
  doc.rect(MARGIN_LEFT + numberSquareW, y, CONTENT_WIDTH - numberSquareW, h, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  doc.text(title, MARGIN_LEFT + numberSquareW + 4, y + 6.8);

  // Borda externa cinza ao redor de todo o cabeçalho da seção
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, h, 'S');

  return y + h;
}

function drawValidationBlock(
  doc: jsPDF,
  items: Array<{ label: string; value: string }>,
  y: number,
): number {
  if (items.length === 0) return y;
  const headerH = 9;
  const rowH = 9;
  const totalH = headerH + items.length * rowH;
  const labelColW = 60;

  doc.setFillColor(...ACCENT_BG_LIGHT);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, headerH, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN_LEFT + 3, y + 2, 1.5, headerH - 4, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  doc.text('Histórico de Validação', MARGIN_LEFT + 8, y + 6);

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

function drawLabelValueRow(doc: jsPDF, label: string, value: string, y: number, labelWidth: number = 55): number {
  const rowH = 9;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const valueLines = doc.splitTextToSize(value || '', CONTENT_WIDTH - labelWidth - 8);
  const usedH = Math.max(rowH, valueLines.length * 4.3 + 3);

  doc.setFillColor(...WHITE);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, usedH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...LABEL_GRAY);
  doc.text(label, MARGIN_LEFT + 4, y + 5.8);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_GRAY);
  doc.text(valueLines, MARGIN_LEFT + labelWidth + 4, y + 5.8);

  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, usedH, 'S');
  doc.line(MARGIN_LEFT + labelWidth, y, MARGIN_LEFT + labelWidth, y + usedH);

  return y + usedH;
}

// Conversão: fontSize (pt) × 0.3528 mm/pt × lineHeightFactor 1.4 = altura real da linha em mm.
// Para fontSize 9 → ~4.45mm; arredondamos pra cima e adicionamos folga pra evitar overflow.
function lineHeightFor(fontSize: number): number {
  return fontSize * 0.3528 * 1.4 + 0.15;
}

// Quebra o texto em parágrafos (split por \n) e wrap por largura.
function splitParagraphs(doc: jsPDF, text: string, maxWidth: number): string[][] {
  const paragraphs = (text || '').split('\n');
  return paragraphs.map(p => {
    const trimmed = p.replace(/\s+$/, '');
    if (!trimmed) return [];
    return doc.splitTextToSize(trimmed, maxWidth) as string[];
  });
}

function countVisualLines(wrapped: string[][]): number {
  return wrapped.reduce((acc, p) => acc + (p.length === 0 ? 1 : p.length), 0);
}

// Renderiza parágrafo a parágrafo — jsPDF deixa naturalmente a última linha de cada
// array sem justify, então a última linha de cada parágrafo não fica esticada.
function renderJustifiedParagraphs(
  doc: jsPDF,
  wrapped: string[][],
  x: number,
  baselineY: number,
  maxWidth: number,
  lineHeight: number
): void {
  let lineCursor = 0;
  for (const paraLines of wrapped) {
    if (paraLines.length === 0) {
      lineCursor++;
      continue;
    }
    doc.text(paraLines, x, baselineY + lineCursor * lineHeight, {
      align: 'justify',
      maxWidth,
      lineHeightFactor: 1.4,
    });
    lineCursor += paraLines.length;
  }
}

function drawTextCell(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  options?: { bold?: boolean; fontSize?: number; align?: 'left' | 'center' | 'right'; bg?: readonly [number, number, number] }
) {
  const fontSize = options?.fontSize || 9;
  const align = options?.align || 'left';

  doc.setFillColor(...(options?.bg || WHITE));
  doc.rect(x, y, w, h, 'F');

  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, 'S');

  doc.setFontSize(fontSize);
  doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
  doc.setTextColor(...(options?.bold ? LABEL_GRAY : TEXT_GRAY));

  const innerW = w - 6;
  const wrapped = splitParagraphs(doc, text, innerW);
  const totalLines = countVisualLines(wrapped);

  if (totalLines <= 1) {
    const textX = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 3 : x + 3;
    doc.text(text || '', textX, y + h / 2 + fontSize * 0.15, { align });
  } else {
    // Multi-linha: respeita align center/right (sem justify). Default 'left' usa justify por parágrafo.
    const lineHeightMm = lineHeightFor(fontSize);
    const textBlockH = totalLines * lineHeightMm;
    const yTop = y + Math.max(2, (h - textBlockH) / 2);
    const yFirstBaseline = yTop + lineHeightMm * 0.78;
    if (align === 'center' || align === 'right') {
      const textX = align === 'center' ? x + w / 2 : x + w - 3;
      const allLines = wrapped.flatMap(p => p.length === 0 ? [''] : p);
      allLines.forEach((line, i) => {
        if (!line) return;
        doc.text(line, textX, yFirstBaseline + i * lineHeightMm, { align });
      });
    } else {
      renderJustifiedParagraphs(doc, wrapped, x + 3, yFirstBaseline, innerW, lineHeightMm);
    }
  }
}

function calcRowHeight(doc: jsPDF, cells: Array<{ text: string; width: number }>, fontSize: number = 9, minHeight: number = 9): number {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'normal');
  let maxLines = 1;
  for (const cell of cells) {
    const wrapped = splitParagraphs(doc, cell.text || '', cell.width - 6);
    maxLines = Math.max(maxLines, countVisualLines(wrapped));
  }
  // Usa o MESMO lineHeight do drawTextCell + padding vertical generoso (4mm)
  // pra que a altura calculada comporte o texto sem vazar.
  return Math.max(minHeight, maxLines * lineHeightFor(fontSize) + 4);
}

// Fonte padronizada com o body do "Histórico de Validação" (9pt).
function drawMultilineContent(doc: jsPDF, text: string, y: number, minHeight: number = 18): number {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_GRAY);

  const maxW = CONTENT_WIDTH - 8;
  // lineHeight tem que casar com fontSize × lineHeightFactor real
  // (9pt ≈ 3.18mm × 1.4 = 4.45mm). Usar valor menor faz o texto vazar pra fora
  // do retângulo. Padding adicional no rodapé garante folga visual.
  const lineHeight = 4.6;
  const paddingTop = 5;
  const paddingBottom = 3;
  const bottomLimit = FOOTER_Y - 5;

  // Pré-quebra em parágrafos + linhas visuais — preserva estrutura pra renderizar
  // cada parágrafo separadamente (assim a última linha de cada um fica sem justify).
  const wrapped = splitParagraphs(doc, text, maxW);
  const flat: Array<{ text: string; paraIdx: number }> = [];
  wrapped.forEach((paraLines, paraIdx) => {
    if (paraLines.length === 0) {
      flat.push({ text: '', paraIdx: -1 });
    } else {
      paraLines.forEach(l => flat.push({ text: l, paraIdx }));
    }
  });

  if (flat.length === 0) {
    if (y + minHeight > bottomLimit) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, minHeight, 'S');
    return y + minHeight;
  }

  let lineIndex = 0;
  while (lineIndex < flat.length) {
    let availableHeight = bottomLimit - y;
    // Espaço mínimo necessário: pelo menos 1 linha+padding OU minHeight (quando vier
    // o primeiro/único chunk que enforça minHeight). Sem essa segunda condição a box
    // pode estourar pra dentro da área do rodapé.
    const isFirstChunkNow = lineIndex === 0;
    const minNeeded = Math.max(
      lineHeight + paddingTop + paddingBottom,
      isFirstChunkNow ? minHeight : 0
    );
    if (availableHeight < minNeeded) {
      doc.addPage();
      y = 20;
      availableHeight = bottomLimit - y;
    }

    const linesAvailable = Math.max(1, Math.floor((availableHeight - paddingTop - paddingBottom) / lineHeight));
    const chunkEnd = Math.min(flat.length, lineIndex + linesAvailable);
    const chunkLen = chunkEnd - lineIndex;
    const isFirstAndLastChunk = lineIndex === 0 && chunkEnd >= flat.length;
    let chunkHeight = chunkLen * lineHeight + paddingTop + paddingBottom;
    if (isFirstAndLastChunk) {
      chunkHeight = Math.max(minHeight, chunkHeight);
    }

    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, chunkHeight, 'S');

    // Centraliza verticalmente; renderiza por sub-parágrafo dentro do chunk.
    const textBlockH = chunkLen * lineHeight;
    const yFirstBaseline = y + Math.max(paddingTop, (chunkHeight - textBlockH) / 2) + lineHeight - 1;

    let subStart = lineIndex;
    while (subStart < chunkEnd) {
      const paraIdx = flat[subStart].paraIdx;
      if (paraIdx === -1) {
        subStart++;
        continue;
      }
      let subEnd = subStart + 1;
      while (subEnd < chunkEnd && flat[subEnd].paraIdx === paraIdx) subEnd++;
      const subLines = flat.slice(subStart, subEnd).map(it => it.text);
      const yLine = yFirstBaseline + (subStart - lineIndex) * lineHeight;
      doc.text(subLines, MARGIN_LEFT + 4, yLine, {
        align: 'justify',
        maxWidth: maxW,
        lineHeightFactor: 1.4,
      });
      subStart = subEnd;
    }

    y += chunkHeight;
    lineIndex = chunkEnd;

    if (lineIndex < flat.length) {
      doc.addPage();
      y = 20;
    }
  }

  return y;
}

function checkPageBreak(doc: jsPDF, currentY: number, neededHeight: number): number {
  if (currentY + neededHeight > FOOTER_Y - 5) {
    doc.addPage();
    return 20;
  }
  return currentY;
}

export function generateTEPPdf(projeto: Projeto, tep: Tep, entregas: Entrega[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = 0;

  // ============================================================
  // HEADER - Fundo verde claro, texto escuro, brasão + faixa verde abaixo
  // ============================================================
  const headerY = 0;
  const headerH = 55;

  // Fundo do cabeçalho em tom verde claro
  doc.setFillColor(...ACCENT_BG_LIGHT);
  doc.rect(0, headerY, PAGE_WIDTH, headerH, 'F');

  const leftMaxW = PAGE_WIDTH * 0.6 - (MARGIN_LEFT + 5) - 4;

  // Título principal
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  const titleLines = doc.splitTextToSize('Termo de Encerramento do Projeto', leftMaxW);
  const titleY = headerY + 16;
  doc.text(titleLines, MARGIN_LEFT + 5, titleY);
  const titleLineH = 8.1;
  const titleEndY = titleY + (titleLines.length - 1) * titleLineH;

  // Subtítulo "TEP"
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  const tepLabelY = titleEndY + 9;
  doc.text('TEP', MARGIN_LEFT + 5, tepLabelY);

  // Área / diretoria
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SUBTLE_GRAY);
  const areaText = (projeto as any).areas_execucao_diretorias || projeto.diretoria || '';
  const areaLines = doc.splitTextToSize(areaText, leftMaxW);
  const areaStartY = tepLabelY + 7;
  doc.text(areaLines, MARGIN_LEFT + 5, areaStartY);
  const areaEndY = areaStartY + (areaLines.length - 1) * 4.5;

  // Status
  const tepStatus = tep.tep_validado_patrocinador_em
    ? `Validado em ${formatDate(tep.tep_validado_patrocinador_em)}`
    : tep.tep_validado_diretor_em
      ? 'Aguardando validação do Patrocinador'
      : tep.tep_validado_gestor_em
        ? 'Aguardando validação da Diretoria'
        : 'Aguardando validação do Gestor';
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  doc.text(doc.splitTextToSize(`Status: ${tepStatus}`, leftMaxW), MARGIN_LEFT + 5, areaEndY + 7);

  // Lado direito - Imagem única "PODER JUDICIÁRIO / Tribunal de Justiça do Estado de Goiás"
  const rightZoneStart = PAGE_WIDTH * 0.6;
  const rightZoneWidth = PAGE_WIDTH * 0.4;
  const rightCenterX = rightZoneStart + rightZoneWidth / 2;

  const imgW = 60;
  const imgH = imgW * (1217 / 2071);
  const imgY = headerY + (headerH - imgH) / 2;
  doc.addImage(P_CENT_BASE64, 'PNG', rightCenterX - imgW / 2, imgY, imgW, imgH, undefined, 'FAST');

  // Faixa horizontal verde separando o header do corpo
  doc.setFillColor(...ACCENT);
  doc.rect(0, headerH, PAGE_WIDTH, 2, 'F');

  y = headerY + headerH + 10;

  // ============================================================
  // BLOCO - Histórico de Validação
  // ============================================================
  const validationItems: Array<{ label: string; value: string }> = [];
  validationItems.push({
    label: 'Validação do Gestor',
    value: tep.tep_validado_gestor_em
      ? `${projeto.gestor_nome || 'Gestor'} — ${formatDateTime(tep.tep_validado_gestor_em)}`
      : 'Pendente',
  });
  validationItems.push({
    label: 'Validação da Diretoria',
    value: tep.tep_validado_diretor_em
      ? `${projeto.diretoria || 'Diretoria'} — ${formatDateTime(tep.tep_validado_diretor_em)}`
      : 'Pendente',
  });
  validationItems.push({
    label: 'Validação do Patrocinador',
    value: tep.tep_validado_patrocinador_em
      ? `${projeto.patrocinador_nome || 'Patrocinador'} — ${formatDateTime(tep.tep_validado_patrocinador_em)}`
      : 'Pendente',
  });
  y = drawValidationBlock(doc, validationItems, y);

  // ============================================================
  // SEÇÃO 1 - Identificação do Projeto
  // ============================================================
  y = drawNumberedSectionHeader(doc, 1, 'Identificação do Projeto', y);
  y = drawLabelValueRow(doc, 'Nome do Projeto', projeto.nome || '', y);
  y = drawLabelValueRow(doc, 'Área Responsável', (projeto as any).areas_execucao_diretorias || projeto.diretoria || '', y);
  y = drawLabelValueRow(doc, 'Nº do Proad', projeto.tap_vinculado || '', y);
  y = drawLabelValueRow(doc, 'ID do Projeto', projeto.tap_id || '', y);
  y += 6;

  // ============================================================
  // SEÇÃO 2 - Tipo de Encerramento
  // ============================================================
  const isDescontinuado = tep.tipo_encerramento === 'cancelado';
  y = drawNumberedSectionHeader(doc, 2, 'Tipo de Encerramento', y);
  y = drawMultilineContent(doc, `(${tep.tipo_encerramento === 'concluido' ? 'X' : ' '}) Concluído     (${isDescontinuado ? 'X' : ' '}) Descontinuado`, y, 12);
  y += 6;

  let secao = 3;

  // SEÇÃO - Motivo da Descontinuidade (somente quando descontinuado)
  if (isDescontinuado) {
    y = checkPageBreak(doc, y, 20);
    y = drawNumberedSectionHeader(doc, secao, 'Motivo da Descontinuidade do Projeto', y);
    y = drawMultilineContent(doc, tep.motivo_cancelamento || 'Não informado', y, 25);
    y += 6;
    secao++;
  }

  // SEÇÃO - Entrega de Resultados — só quebra se não couber header + 1ª linha
  y = checkPageBreak(doc, y, 20);
  y = drawNumberedSectionHeader(doc, secao++, 'Entrega de Resultados', y);

  const entregaHeaderH = 9;
  const colEntregaNome = CONTENT_WIDTH * 0.65;
  const colEntregaData = CONTENT_WIDTH * 0.35;

  drawTextCell(doc, 'Nome da Entrega', MARGIN_LEFT, y, colEntregaNome, entregaHeaderH, { bold: true, fontSize: 9, align: 'center', bg: ACCENT_BG_LIGHT });
  drawTextCell(doc, 'Data de Conclusão', MARGIN_LEFT + colEntregaNome, y, colEntregaData, entregaHeaderH, { bold: true, fontSize: 9, align: 'center', bg: ACCENT_BG_LIGHT });
  y += entregaHeaderH;

  if (entregas.length === 0) {
    const rowH = 9;
    y = checkPageBreak(doc, y, rowH);
    drawTextCell(doc, 'Nenhuma entrega cadastrada.', MARGIN_LEFT, y, CONTENT_WIDTH, rowH, { align: 'center', fontSize: 9 });
    y += rowH;
  } else {
    for (const entrega of entregas) {
      const dataConclusao = entrega.status === 'concluida' ? formatDate(entrega.updated_at as any) : '';
      const rowH = calcRowHeight(doc, [
        { text: entrega.nome || '', width: colEntregaNome },
        { text: dataConclusao, width: colEntregaData },
      ]);
      y = checkPageBreak(doc, y, rowH);
      drawTextCell(doc, entrega.nome || '', MARGIN_LEFT, y, colEntregaNome, rowH);
      drawTextCell(doc, dataConclusao, MARGIN_LEFT + colEntregaNome, y, colEntregaData, rowH, { align: 'center' });
      y += rowH;
    }
  }
  y += 6;

  // SEÇÃO - Documentos Gerados pela Execução do Projeto
  y = checkPageBreak(doc, y, 25);
  y = drawNumberedSectionHeader(doc, secao++, 'Documentos Gerados pela Execução do Projeto', y);

  const evidencias = entregas.filter(e => e.evidencia_filename);
  if (evidencias.length === 0) {
    y = drawMultilineContent(doc, 'Nenhuma evidência anexada às entregas.', y, 12);
  } else {
    const evidHeaderH = 9;
    const colDocNome = CONTENT_WIDTH * 0.65;
    const colDocEntrega = CONTENT_WIDTH * 0.35;

    drawTextCell(doc, 'Documento', MARGIN_LEFT, y, colDocNome, evidHeaderH, { bold: true, fontSize: 9, align: 'center', bg: ACCENT_BG_LIGHT });
    drawTextCell(doc, 'Entrega Vinculada', MARGIN_LEFT + colDocNome, y, colDocEntrega, evidHeaderH, { bold: true, fontSize: 9, align: 'center', bg: ACCENT_BG_LIGHT });
    y += evidHeaderH;

    for (const ev of evidencias) {
      const rowH = calcRowHeight(doc, [
        { text: ev.evidencia_filename || '', width: colDocNome },
        { text: ev.nome || '', width: colDocEntrega },
      ]);
      y = checkPageBreak(doc, y, rowH);
      drawTextCell(doc, ev.evidencia_filename || '', MARGIN_LEFT, y, colDocNome, rowH);
      drawTextCell(doc, ev.nome || '', MARGIN_LEFT + colDocNome, y, colDocEntrega, rowH);
      y += rowH;
    }
  }

  // SEÇÃO - Considerações Finais (somente quando concluído)
  if (!isDescontinuado) {
    y += 6;
    y = checkPageBreak(doc, y, 20);
    y = drawNumberedSectionHeader(doc, secao++, 'Considerações Finais do Gestor do Projeto', y);
    y = drawMultilineContent(doc, tep.consideracoes_gerente || '', y, 22);
    y += 6;

    y = checkPageBreak(doc, y, 20);
    y = drawNumberedSectionHeader(doc, secao++, 'Considerações Finais do Patrocinador do Projeto', y);
    y = drawMultilineContent(doc, tep.consideracoes_patrocinador || '', y, 22);
  }

  // ============================================================
  // RODAPÉS em todas as páginas
  // ============================================================
  const totalPages = doc.getNumberOfPages();
  const versao = tep.tep_versao || 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, versao, projeto.tap_id || null);
  }

  // Abrir PDF em nova aba
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl as unknown as string, '_blank');
}
