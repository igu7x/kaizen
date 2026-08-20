import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Loader2,
  Mail,
  Building2,
  Briefcase,
  Award,
  ShieldCheck,
  AlertCircle,
  User as UserIcon,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import { pessoasApi, PerfilCompleto } from "@/services/pessoasApi";
import { avaliacaoIntegradaApi } from "@/services/avaliacaoIntegradaApi";

interface PerfilPessoaModalProps {
  pessoaId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Linha de info no formato "label / valor", com ícone à esquerda.
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  const empty = !value || !value.toString().trim();
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </div>
        <div
          className={`mt-0.5 text-sm leading-tight ${
            empty ? "italic text-slate-400" : "text-slate-800"
          }`}
        >
          {empty ? "Não indicado" : value}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="mb-1 flex items-center gap-2 border-b border-slate-100 pb-2">
        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          {title}
        </h3>
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  );
}

export default function PerfilPessoaModal({
  pessoaId,
  open,
  onOpenChange,
}: PerfilPessoaModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  // Metadados da última resultado final do colaborador, ou null se não houver.
  // O botão "Avaliação do Colaborador" só aparece quando isto está preenchido.
  const [integradaMeta, setIntegradaMeta] = useState<{
    id: number;
    tipo_inventario: "equipe" | "gestor";
  } | null>(null);

  useEffect(() => {
    if (!open || pessoaId == null) {
      setPerfil(null);
      setError(null);
      setIntegradaMeta(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    pessoasApi
      .getPerfilCompleto(pessoaId)
      .then((data) => {
        if (!cancelled) setPerfil(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Erro ao carregar perfil");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, pessoaId]);

  useEffect(() => {
    if (!perfil?.user_id) {
      setIntegradaMeta(null);
      return;
    }

    let cancelled = false;
    avaliacaoIntegradaApi.getByPessoaMeta(perfil.user_id).then((res) => {
      if (!cancelled && res) {
        setIntegradaMeta({
          id: res.id,
          tipo_inventario: res.tipo_inventario,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [perfil?.user_id]);

  const handleAbrirAvaliacao = () => {
    if (!integradaMeta) return;
    onOpenChange(false);
    navigate(
      `/pessoas/competencias?integradaId=${integradaMeta.id}&tipo=${integradaMeta.tipo_inventario}`,
    );
  };

  const nomeExibido =
    perfil?.nome_exibicao?.trim() ||
    perfil?.nome?.trim() ||
    perfil?.user_name?.trim() ||
    "Sem nome";
  const emailExibido =
    perfil?.email?.trim() || perfil?.user_email?.trim() || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden border-0 bg-white p-0 sm:rounded-2xl [&>button]:text-white [&>button]:opacity-80 [&>button:hover]:opacity-100">
        {loading && (
          <div className="flex h-72 flex-col items-center justify-center gap-3 bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-slate-500">Carregando perfil…</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex h-72 flex-col items-center justify-center gap-3 bg-white p-6 text-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm font-medium text-slate-700">
              Não foi possível carregar o perfil
            </p>
            <p className="text-xs text-slate-500">{error}</p>
          </div>
        )}

        {!loading && !error && perfil && (
          <>
            {/* Hero: foto + nome + email com fundo gradiente */}
            <div className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 px-6 pb-5 pt-7">
              <div className="flex items-center gap-4">
                {perfil.foto_perfil ? (
                  <img
                    src={perfil.foto_perfil}
                    alt={nomeExibido}
                    className="h-20 w-20 flex-shrink-0 rounded-full object-cover ring-4 ring-white/30 shadow-xl"
                  />
                ) : (
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/30 shadow-xl">
                    <UserIcon className="h-10 w-10 text-white/80" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold text-white">
                    {nomeExibido}
                  </h2>
                  {perfil.cargo_efetivo && (
                    <p className="mt-0.5 text-sm font-medium text-blue-200">
                      {perfil.cargo_efetivo}
                    </p>
                  )}
                  {emailExibido && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/70">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{emailExibido}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Corpo: seções */}
            <div className="space-y-3 bg-slate-50 px-5 py-5 max-h-[60vh] overflow-y-auto">
              {/* Atalho para a Resultado Final — só aparece quando existe
                  registro preenchido (consultado via /api/avaliacao-integrada/by-pessoa). */}
              {integradaMeta && (
                <button
                  type="button"
                  onClick={handleAbrirAvaliacao}
                  className="group w-full rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 text-left transition hover:border-blue-300 hover:from-blue-100 hover:to-indigo-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 transition group-hover:bg-blue-200">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                        Gestão por Competências
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-800">
                        Avaliação do Colaborador
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 flex-shrink-0 text-blue-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
                  </div>
                </button>
              )}

              <Section title="Lotação">
                <InfoRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="Diretoria"
                  value={perfil.area_nome}
                />
                <InfoRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="Unidade"
                  value={perfil.unidade_nome}
                />
              </Section>

              <Section title="Identificação Funcional">
                <InfoRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Cargo Efetivo"
                  value={perfil.cargo_efetivo}
                />
                <InfoRow
                  icon={<Award className="h-4 w-4" />}
                  label="Código"
                  value={perfil.cc_fc_classe}
                />
                <InfoRow
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Situação Funcional"
                  value={perfil.situacao}
                />
              </Section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
