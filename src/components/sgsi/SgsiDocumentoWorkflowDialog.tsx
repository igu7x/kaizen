import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  Unlock,
  Save,
  PenLine,
  RotateCcw,
  FileClock,
  ShieldCheck,
  Send,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getUsers } from "@/services/api";
import type { User } from "@/types";
import {
  sgsiApi,
  SgsiDocumento,
  SgsiDocumentoVersao,
  SgsiDocumentoAssinatura,
  SgsiDocumentoColaborador,
  SgsiDocumentoTramitacao,
} from "@/services/sgsiApi";

const TRAVADOS = ["EM_ASSINATURA", "ASSINADO", "PUBLICADO"];

function fmtDataHora(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function SgsiDocumentoWorkflowDialog({
  doc,
  open,
  onOpenChange,
  onAtualizado,
}: {
  doc: SgsiDocumento;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAtualizado: (d: SgsiDocumento) => void;
}) {
  const { user } = useAuth();
  const meuId = user?.id != null ? Number(user.id) : null;

  const [conteudo, setConteudo] = useState("");
  const [versoes, setVersoes] = useState<SgsiDocumentoVersao[]>([]);
  const [assinaturas, setAssinaturas] = useState<SgsiDocumentoAssinatura[]>([]);
  const [colaboradores, setColaboradores] = useState<SgsiDocumentoColaborador[]>(
    [],
  );
  const [tramitacoes, setTramitacoes] = useState<SgsiDocumentoTramitacao[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [destino, setDestino] = useState("");
  const [despacho, setDespacho] = useState("");
  const [novoColab, setNovoColab] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [acao, setAcao] = useState<string | null>(null);

  const travado = TRAVADOS.includes(doc.status);
  const souDono = doc.checkout_id != null && doc.checkout_id === meuId;
  const deTerceiro = doc.checkout_id != null && doc.checkout_id !== meuId;
  const podeEditar = souDono && !travado;

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [vig, vs, ass, colab, tram] = await Promise.all([
        sgsiApi.getVersaoVigente(doc.id),
        sgsiApi.listarVersoesDocumento(doc.id),
        sgsiApi.listarAssinaturasDocumento(doc.id),
        sgsiApi.listarColaboradoresDocumento(doc.id),
        sgsiApi.listarTramitacoesDocumento(doc.id),
      ]);
      setConteudo(vig?.conteudo ?? "");
      setVersoes(vs);
      setAssinaturas(ass);
      setColaboradores(colab);
      setTramitacoes(tram);
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setCarregando(false);
    }
  }, [doc.id]);

  useEffect(() => {
    if (open) recarregar();
  }, [open, recarregar]);

  useEffect(() => {
    if (open && usuarios.length === 0) {
      getUsers()
        .then((us) => setUsuarios(us.filter((u) => u.status === "ACTIVE")))
        .catch(() => {});
    }
  }, [open, usuarios.length]);

  async function run(nome: string, fn: () => Promise<SgsiDocumento>, ok: string) {
    setAcao(nome);
    try {
      const upd = await fn();
      onAtualizado(upd);
      toast.success(ok);
      await recarregar();
    } catch {
      /* apiClient já exibe a mensagem do backend */
    } finally {
      setAcao(null);
    }
  }

  const assumir = () =>
    run("assumir", () => sgsiApi.assumirEdicaoDocumento(doc.id), "Edição assumida.");
  const liberar = () =>
    run("liberar", () => sgsiApi.liberarEdicaoDocumento(doc.id), "Checkout liberado.");
  const gravar = () =>
    run("gravar", () => sgsiApi.gravarVersaoDocumento(doc.id, conteudo), "Versão gravada.");
  const assinar = () =>
    run("assinar", () => sgsiApi.assinarDocumento(doc.id), "Documento assinado.");

  const tramitar = () => {
    if (!destino) return;
    run(
      "tramitar",
      () =>
        sgsiApi.tramitarDocumento(
          doc.id,
          Number(destino),
          despacho.trim() || null,
        ),
      "Documento tramitado.",
    ).then(() => {
      setDestino("");
      setDespacho("");
    });
  };

  const adicionarColab = () => {
    if (!novoColab) return;
    run(
      "colab",
      () => sgsiApi.adicionarColaboradorDocumento(doc.id, Number(novoColab)),
      "Colaborador incluído.",
    ).then(() => setNovoColab(""));
  };

  const removerColab = async (usuarioId: number) => {
    setAcao("colab");
    try {
      await sgsiApi.removerColaboradorDocumento(doc.id, usuarioId);
      toast.success("Colaborador removido.");
      await recarregar();
    } catch {
      /* apiClient */
    } finally {
      setAcao(null);
    }
  };

  const reabrir = () => {
    const motivo = window.prompt(
      "Reabrir invalida TODAS as assinaturas. Informe o motivo:",
    );
    if (motivo && motivo.trim()) {
      run("reabrir", () => sgsiApi.reabrirDocumento(doc.id, motivo.trim()), "Documento reaberto.");
    }
  };

  const preverVersao = async (numero: number) => {
    try {
      const v = await sgsiApi.getVersaoDocumento(doc.id, numero);
      setConteudo(v.conteudo);
      toast.info(`Exibindo o conteúdo da versão ${numero} (somente leitura).`);
    } catch {
      /* tratado no apiClient */
    }
  };

  const ocupado = acao !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex min-w-0 items-center gap-2 pr-8">
            <FileClock className="h-5 w-5 text-blue-600 shrink-0" />
            <span className="min-w-0 truncate">Elaboração — {doc.nome}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Barra de estado */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
            Status: {doc.status.replace(/_/g, " ")}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
            {doc.versao_atual ? `v${doc.versao_atual}` : "sem versão"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
            {doc.assinaturas ?? 0} assinatura(s)
          </span>
          {doc.checkout_id != null && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium",
                souDono
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700",
              )}
            >
              {souDono
                ? "Em edição por você"
                : `Em edição por ${doc.checkout_nome || "outro usuário"}`}
            </span>
          )}
          {travado && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-600">
              Conteúdo travado
            </span>
          )}
        </div>

        {/* Ações de checkout */}
        <div className="flex flex-wrap gap-2">
          {!travado && !souDono && (
            <Button
              size="sm"
              variant="outline"
              onClick={assumir}
              disabled={ocupado || deTerceiro}
            >
              <Lock className="h-3.5 w-3.5 mr-1.5" />
              Assumir edição
            </Button>
          )}
          {souDono && (
            <Button size="sm" variant="outline" onClick={liberar} disabled={ocupado}>
              <Unlock className="h-3.5 w-3.5 mr-1.5" />
              Liberar edição
            </Button>
          )}
          {travado && doc.status !== "PUBLICADO" && (
            <Button
              size="sm"
              variant="outline"
              onClick={reabrir}
              disabled={ocupado}
              className="text-red-600 hover:text-red-700"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reabrir (invalida assinaturas)
            </Button>
          )}
        </div>

        {/* Editor */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Conteúdo {doc.versao_atual ? `(vigente: v${doc.versao_atual})` : ""}
          </label>
          {carregando ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando…
            </div>
          ) : (
            <textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              readOnly={!podeEditar}
              rows={10}
              placeholder={
                podeEditar
                  ? "Escreva o conteúdo do documento…"
                  : "Assuma a edição para escrever."
              }
              className={cn(
                "mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1",
                podeEditar
                  ? "border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                  : "border-slate-200 bg-slate-50 text-slate-500",
              )}
            />
          )}
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {conteudo.length} caractere(s)
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={gravar}
                disabled={ocupado || !podeEditar || !conteudo.trim()}
              >
                {acao === "gravar" ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Gravar versão
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={assinar}
                disabled={
                  ocupado ||
                  !doc.versao_atual ||
                  (travado && doc.status !== "EM_ASSINATURA")
                }
              >
                {acao === "assinar" ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <PenLine className="h-3.5 w-3.5 mr-1.5" />
                )}
                Assinar
              </Button>
            </div>
          </div>
        </div>

        {/* Histórico e assinaturas */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Versões ({versoes.length})
            </p>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-52 overflow-auto">
              {versoes.length === 0 ? (
                <p className="px-3 py-4 text-xs text-slate-400">
                  Nenhuma versão gravada.
                </p>
              ) : (
                versoes.map((v) => (
                  <button
                    key={v.numero}
                    onClick={() => preverVersao(v.numero)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-700">v{v.numero}</span>
                    <span className="text-slate-400">
                      {v.autor_nome || "—"} · {v.caracteres} car. ·{" "}
                      {fmtDataHora(v.criado_em)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Assinaturas ({assinaturas.length})
            </p>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-52 overflow-auto">
              {assinaturas.length === 0 ? (
                <p className="px-3 py-4 text-xs text-slate-400">
                  Nenhuma assinatura.
                </p>
              ) : (
                assinaturas.map((a, i) => (
                  <div key={i} className="px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{a.nome}</span>
                      <span className="text-slate-400">
                        v{a.versao_numero} · {fmtDataHora(a.criado_em)}
                      </span>
                    </div>
                    <span
                      className="block truncate font-mono text-[10px] text-slate-400"
                      title={a.hash_sha256}
                    >
                      {a.hash_sha256}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tramitação */}
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Send className="h-3.5 w-3.5" />
            Tramitação
            {doc.titular_nome && (
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 font-normal normal-case text-slate-600">
                titular atual: {doc.titular_nome}
              </span>
            )}
          </p>
          {!travado && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px] flex-1">
                <Select value={destino} onValueChange={setDestino}>
                  <SelectTrigger className="h-9 bg-white">
                    <SelectValue placeholder="Encaminhar para…" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuarios.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <input
                value={despacho}
                onChange={(e) => setDespacho(e.target.value)}
                placeholder="Despacho (opcional)"
                className="h-9 min-w-[180px] flex-[2] rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Button
                size="sm"
                className="shrink-0"
                onClick={tramitar}
                disabled={acao !== null || !destino}
              >
                {acao === "tramitar" ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                Tramitar
              </Button>
            </div>
          )}
          {tramitacoes.length > 0 && (
            <ul className="mt-2 space-y-1">
              {tramitacoes.map((t) => (
                <li key={t.id} className="text-xs text-slate-500">
                  <span className="text-slate-400">{fmtDataHora(t.criado_em)}</span>{" "}
                  · {t.de_nome || "—"} → <strong>{t.para_nome || "—"}</strong>
                  {t.despacho ? `: ${t.despacho}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Colaboradores */}
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Users className="h-3.5 w-3.5" />
            Colaboradores ({colaboradores.length})
            <span className="font-normal normal-case text-slate-400">
              — direito permanente de edição
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {colaboradores.map((c) => (
              <span
                key={c.usuario_id}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {c.nome}
                <button
                  onClick={() => removerColab(c.usuario_id)}
                  className="text-slate-400 hover:text-red-600"
                  title="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {colaboradores.length === 0 && (
              <span className="text-xs text-slate-400">Nenhum colaborador.</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <Select value={novoColab} onValueChange={setNovoColab}>
                <SelectTrigger className="h-9 bg-white">
                  <SelectValue placeholder="Adicionar colaborador…" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios
                    .filter(
                      (u) =>
                        !colaboradores.some((c) => c.usuario_id === Number(u.id)),
                    )
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={adicionarColab}
              disabled={acao !== null || !novoColab}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Incluir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
