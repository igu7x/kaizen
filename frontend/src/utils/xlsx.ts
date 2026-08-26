import { strToU8, zipSync } from "fflate";

/**
 * Escritor mínimo de XLSX (Office Open XML).
 *
 * Por que escrever à mão em vez de puxar uma lib: o `.xlsx` é só um zip de XML e o `fflate` já vem
 * na árvore (dependência do jspdf). Uma lib de planilha completa custaria ~1 MB de bundle e um
 * pacote novo pra resolver no registry do TJGO, para um recurso que precisa de cabeçalho, largura
 * de coluna, autofiltro e hyperlink — nada além disso.
 *
 * Corpo e cabeçalho saem centrados na horizontal e na vertical, com quebra de linha e borda fina.
 * Suporta: uma aba, cabeçalho fixo (freeze pane), autofiltro, largura de coluna, texto/número e
 * hyperlink por célula (inclusive relativo, para apontar pra arquivos empacotados junto no zip).
 */

export interface XlsxColumn {
  header: string;
  /** Largura em "caracteres" do Excel. */
  width: number;
}

export interface XlsxCell {
  value: string | number | null | undefined;
  /** Alvo do hyperlink. Relativo (ex.: `evidencias/AG01.pdf`) ou absoluto (`https://…`). */
  link?: string;
}

export interface XlsxOptions {
  sheetName: string;
  columns: XlsxColumn[];
  rows: XlsxCell[][];
}

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";

const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Índices em `cellXfs` (styles.xml), usados no atributo `s=` das células. */
const ESTILO_CABECALHO = 1;
const ESTILO_CELULA = 2;
const ESTILO_LINK = 3;

/**
 * XML 1.0 só aceita tab, LF, CR e códigos a partir de 32 — um caractere de controle vindo de um
 * nome de arquivo qualquer corromperia a planilha inteira, então é descartado aqui.
 */
function semControles(v: string): string {
  let saida = "";
  for (const ch of v) {
    const codigo = ch.codePointAt(0) ?? 0;
    if (codigo === 9 || codigo === 10 || codigo === 13 || codigo >= 32) saida += ch;
  }
  return saida;
}

function esc(v: string): string {
  return semControles(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0 → A, 25 → Z, 26 → AA. */
export function colunaLetra(indice: number): string {
  let n = indice + 1;
  let s = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    n = Math.floor((n - resto) / 26);
  }
  return s;
}

function contentTypes(): string {
  return `${DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
}

function relsRaiz(): string {
  return `${DECL}<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function workbook(sheetName: string): string {
  // O Excel rejeita > 31 caracteres e os caracteres proibidos abaixo no nome da aba.
  const nome = esc(sheetName.replace(/[\\/*?:[\]]/g, " ").slice(0, 31));
  return `${DECL}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets><sheet name="${nome}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

function workbookRels(): string {
  return `${DECL}<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`;
}

function styles(): string {
  return (
    `${DECL}<styleSheet xmlns="${NS_MAIN}">` +
    `<fonts count="3">` +
    `<font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
    `<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font>` +
    `</fonts>` +
    `<fills count="3">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/><bgColor indexed="64"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="2">` +
    `<border><left/><right/><top/><bottom/><diagonal/></border>` +
    `<border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border>` +
    `</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="4">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
    `<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
    `</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`
  );
}

function celula(ref: string, cell: XlsxCell, estilo: number): string {
  const v = cell.value;
  if (v == null || v === "") return `<c r="${ref}" s="${estilo}"/>`;
  if (typeof v === "number" && Number.isFinite(v)) {
    return `<c r="${ref}" s="${estilo}"><v>${v}</v></c>`;
  }
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

/**
 * Gera os bytes de um `.xlsx`.
 *
 * A ordem dos elementos dentro de `<worksheet>` segue o schema (cols → sheetData → autoFilter →
 * hyperlinks); trocar a ordem faz o Excel acusar arquivo corrompido.
 */
export function buildXlsx({ sheetName, columns, rows }: XlsxOptions): Uint8Array {
  const ultimaColuna = colunaLetra(Math.max(columns.length - 1, 0));
  const ultimaLinha = rows.length + 1;
  const dimensao = `A1:${ultimaColuna}${ultimaLinha}`;

  const cols = columns
    .map(
      (c, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`,
    )
    .join("");

  const cabecalho =
    `<row r="1" ht="30" customHeight="1">` +
    columns
      .map((c, i) =>
        celula(`${colunaLetra(i)}1`, { value: c.header }, ESTILO_CABECALHO),
      )
      .join("") +
    `</row>`;

  // Hyperlinks moram fora do <sheetData>: a célula só guarda o texto e a ligação é declarada por
  // referência (ref) apontando pra uma relationship do sheet1.
  const links: { ref: string; rid: string; target: string }[] = [];

  const corpo = rows
    .map((linha, r) => {
      const numero = r + 2;
      const celulas = columns
        .map((_, i) => {
          const cell = linha[i] ?? { value: null };
          const ref = `${colunaLetra(i)}${numero}`;
          if (cell.link && cell.value != null && cell.value !== "") {
            const rid = `rIdL${links.length + 1}`;
            links.push({ ref, rid, target: cell.link });
            return celula(ref, cell, ESTILO_LINK);
          }
          return celula(ref, cell, ESTILO_CELULA);
        })
        .join("");
      return `<row r="${numero}">${celulas}</row>`;
    })
    .join("");

  const hyperlinks = links.length
    ? `<hyperlinks>${links
        .map((l) => `<hyperlink ref="${l.ref}" r:id="${l.rid}"/>`)
        .join("")}</hyperlinks>`
    : "";

  const sheet =
    `${DECL}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="${dimensao}"/>` +
    `<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${cabecalho}${corpo}</sheetData>` +
    (rows.length ? `<autoFilter ref="${dimensao}"/>` : "") +
    hyperlinks +
    `</worksheet>`;

  const arquivos: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes()),
    "_rels/.rels": strToU8(relsRaiz()),
    "xl/workbook.xml": strToU8(workbook(sheetName)),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRels()),
    "xl/styles.xml": strToU8(styles()),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  };

  if (links.length) {
    arquivos["xl/worksheets/_rels/sheet1.xml.rels"] = strToU8(
      `${DECL}<Relationships xmlns="${NS_PKG_REL}">` +
        links
          .map(
            (l) =>
              `<Relationship Id="${l.rid}" Type="${NS_REL}/hyperlink" Target="${esc(
                l.target,
              )}" TargetMode="External"/>`,
          )
          .join("") +
        `</Relationships>`,
    );
  }

  return zipSync(arquivos, { level: 6 });
}

/** Dispara o download de um blob no navegador. */
export function baixarArquivo(
  bytes: Uint8Array,
  nomeArquivo: string,
  mime: string,
): void {
  // `slice()` garante um ArrayBuffer próprio (o Uint8Array do fflate pode ser uma view maior).
  const blob = new Blob([bytes.slice().buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revogar na hora corta o download em alguns navegadores; um tick é suficiente.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
