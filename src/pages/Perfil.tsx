import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Camera,
  UserCircle2,
  Lock,
  Save,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import Storage from "@/utils/storage";
import type { User } from "@/types";

const MAX_PHOTO_DIM = 1024; // 1024×1024 max
const PHOTO_QUALITY = 0.96; // JPEG quality (alta — preserva detalhes do rosto)

// Redimensiona/comprime a imagem no client antes de mandar pro backend.
// Retorna um data URL JPEG com no máximo 1024×1024 (mantendo aspecto).
async function readAndCompressImage(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const ratio = Math.min(1, MAX_PHOTO_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context indisponível");
  // Smoothing de alta qualidade — evita serrilhado no downscale
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
}

export default function Perfil() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.getMeuPerfil();
        if (cancelled) return;
        setProfile(me);
        setFotoPerfil(me.foto_perfil || null);
      } catch (err: any) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePickPhoto = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    try {
      const compressed = await readAndCompressImage(file);
      setFotoPerfil(compressed);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleRemovePhoto = () => setFotoPerfil(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateMeuPerfil({
        foto_perfil: fotoPerfil,
      });
      setProfile(updated);
      // Atualiza o user no contexto/Storage pra refletir na home/header
      if (user) {
        const merged: User = {
          ...user,
          foto_perfil: updated.foto_perfil ?? null,
        };
        Storage.save("user", merged);
        setUser(merged);
      }
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  };

  const unidadeLabel =
    profile?.unidade_nome || "Não vinculado a nenhuma unidade";
  const semUnidade = !profile?.unidade_nome;

  return (
    <Layout>
      <div className="-mt-2 mb-2">
        <Breadcrumbs items={[{ label: "Visualizar Perfil" }]} />
      </div>

      <div className="max-w-3xl mx-auto pb-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-sm text-gray-500 mt-1">
            Visualize seus dados institucionais e atualize sua foto de perfil.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Carregando…
          </div>
        ) : !profile ? (
          <Card className="border border-amber-200 bg-amber-50">
            <CardContent className="p-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800">
                  Não foi possível carregar seu perfil
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Tente recarregar a página. Se o problema persistir, contate o
                  administrador.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Card da foto */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Foto de Perfil</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="w-36 h-36 rounded-full bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {fotoPerfil ? (
                      <img
                        src={fotoPerfil}
                        alt="Foto de perfil"
                        className="w-full h-full object-cover"
                        style={{ imageRendering: "auto" }}
                      />
                    ) : (
                      <UserCircle2 className="h-20 w-20 text-gray-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePickPhoto}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {fotoPerfil ? "Trocar foto" : "Adicionar foto"}
                    </Button>
                    {fotoPerfil && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemovePhoto}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remover foto
                      </Button>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      A imagem será redimensionada automaticamente para até
                      1024×1024 px.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dados institucionais (travados) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4 text-gray-400" />
                  Dados Institucionais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-600">Nome</Label>
                    <Input
                      value={profile.name || ""}
                      disabled
                      className="bg-gray-50 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">E-mail</Label>
                    <Input
                      value={profile.email || ""}
                      disabled
                      className="bg-gray-50 mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs text-gray-600">Lotação (Área / Unidade)</Label>
                    <Input
                      value={profile.areaSigla || profile.unidadeSigla ? `${profile.areaSigla || "-"} / ${profile.unidadeSigla || "-"}` : "Sem lotação ativa"}
                      disabled
                      className={`mt-1 ${!(profile.areaSigla || profile.unidadeSigla) ? "bg-amber-50 text-amber-700 italic" : "bg-gray-50"}`}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Nome, e-mail, diretoria e unidade são gerenciados pelo
                  administrador. Para alterações, entre em contato com a equipe
                  responsável.
                </p>
              </CardContent>
            </Card>

            {/* Identificação funcional — todos os campos travados (somente leitura).
                Vêm do cadastro central. */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4 text-gray-400" />
                  Identificação Funcional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-gray-600">Matrícula</Label>
                    <Input
                      value={profile.matricula || "Não indicado"}
                      disabled
                      className={`mt-1 ${profile.matricula ? "bg-gray-50" : "bg-gray-50 italic text-gray-400"}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Situação Funcional</Label>
                    <Input
                      value={profile.situacao_funcional || "Não indicado"}
                      disabled
                      className={`mt-1 ${profile.situacao_funcional ? "bg-gray-50" : "bg-gray-50 italic text-gray-400"}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Cargo Efetivo</Label>
                    <Input
                      value={profile.cargo_efetivo || "Não indicado"}
                      disabled
                      className={`mt-1 ${profile.cargo_efetivo ? "bg-gray-50" : "bg-gray-50 italic text-gray-400"}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Classe Efetivo</Label>
                    <Input
                      value={profile.classe_efetivo || "Não indicado"}
                      disabled
                      className={`mt-1 ${profile.classe_efetivo ? "bg-gray-50" : "bg-gray-50 italic text-gray-400"}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">CC/FC</Label>
                    <Input
                      value={profile.cc_fc || "Não indicado"}
                      disabled
                      className={`mt-1 ${profile.cc_fc ? "bg-gray-50" : "bg-gray-50 italic text-gray-400"}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Código CC/FC</Label>
                    <Input
                      value={profile.codigo || "Não indicado"}
                      disabled
                      className={`mt-1 ${profile.codigo ? "bg-gray-50" : "bg-gray-50 italic text-gray-400"}`}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Esses dados vêm do cadastro central e não podem ser alterados
                  aqui.
                </p>
              </CardContent>
            </Card>

            {/* Botão Salvar — só aparece quando a foto foi modificada */}
            {(() => {
              const dirtyFoto =
                (fotoPerfil || null) !== (profile.foto_perfil || null);
              if (!dirtyFoto) return null;
              return (
                <div className="flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                        Salvando…
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" /> Salvar alterações
                      </>
                    )}
                  </Button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </Layout>
  );
}
