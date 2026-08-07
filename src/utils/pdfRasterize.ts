import * as pdfjsLib from "pdfjs-dist";
// O worker é emitido pelo Vite (?url) e servido pelo próprio host — evita bloqueio de CSP.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Rasteriza a 1ª página de um PDF (data URL ou base64) para PNG, preservando a proporção.
 * Usada para embutir um fluxograma anexado em PDF dentro do documento gerado (jsPDF não
 * embute páginas de PDF direto). Retorna null se não for possível ler/renderizar.
 */
export async function rasterizePdfFirstPage(
  dataUrl: string,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1);

    // Escala mirando ~1600px de largura (nitidez boa sem estourar memória).
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, Math.max(1, 1600 / base.width));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Fundo branco: PDFs podem ter fundo transparente e sairiam pretos no canvas.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    const png = canvas.toDataURL("image/png");
    try {
      await pdf.destroy();
    } catch {
      /* ignore */
    }
    return { dataUrl: png, width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}
