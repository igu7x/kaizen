import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Shield, Lock } from "lucide-react";

/** Animações/tipografia do login — mesma linguagem da Home (balança + anel de ciano, wordmark). */
const LOGIN_CSS = `
  .lk-word { font-family: "Montserrat", Inter, ui-sans-serif, system-ui, sans-serif; }
  @keyframes lk-spin { to { transform: rotate(360deg); } }
  @keyframes lk-card-in { from { opacity: 0; transform: translateY(16px) scale(0.985); } to { opacity: 1; transform: none; } }
  @keyframes lk-sym-in { from { opacity: 0; transform: scale(0.6) rotate(-40deg); } to { opacity: 1; transform: none; } }
  @keyframes lk-fade { from { opacity: 0; } to { opacity: 1; } }
  .lk-card { animation: lk-card-in 0.6s cubic-bezier(0.16,0.84,0.3,1) both; }
  .lk-sym { animation: lk-sym-in 1s cubic-bezier(0.16,0.84,0.3,1) both; }
  .lk-halo { animation: lk-fade 1.4s ease both; }
  .lk-ring { transform-origin: center; animation: lk-spin 34s linear infinite; }
  .lk-cta { transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease; }
  .lk-cta:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); box-shadow: 0 14px 30px -12px rgba(20,120,180,0.65); }
  .lk-cta:focus-visible { outline: 2px solid #1E9BD7; outline-offset: 3px; }
  @media (prefers-reduced-motion: reduce) {
    .lk-card, .lk-sym, .lk-halo, .lk-ring { animation: none !important; opacity: 1; transform: none; }
  }
`;
import { apiClient, API_BASE_URL } from "@/services/apiClient";
import { isLocalLoginEnabled } from "@/utils/environment";
import Storage from "@/utils/storage";
import { POST_LOGIN_REDIRECT_KEY } from "@/components/auth/ProtectedRoute";

/** Destino após o login: a rota guardada pela ProtectedRoute (deep link) ou a home. */
function destinoPosLogin(): string {
  try {
    const alvo = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    if (alvo && alvo.startsWith("/")) return alvo;
  } catch {
    /* sessionStorage indisponível */
  }
  return "/";
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [localLoginAvailable, setLocalLoginAvailable] = useState(false);
  const [useLocalLogin, setUseLocalLogin] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Verificar se SSO e Login Local estão habilitados
  useEffect(() => {
    const checkAuthMethods = async () => {
      // Verificar SSO — independente do login local
      try {
        const ssoResponse = await apiClient.get<{ enabled: boolean }>(
          "/api/auth/sso/status",
        );

        setSsoEnabled(ssoResponse.enabled);
      } catch (err) {
        // Se o status check falhar (ex: erro de cert/rede), assumir SSO habilitado
        // para não bloquear o login em ambientes onde SSO é o único método
        setSsoEnabled(true);
      }

      // Verificar Login Local — bloco separado, não afetado por falha no SSO
      const localEnabledByEnv = isLocalLoginEnabled();

      try {
        const localResponse = await apiClient.get<{
          enabled: boolean;
          _debug?: any;
        }>("/api/auth/local/status");

        setLocalLoginAvailable(localResponse.enabled);
        if (localResponse.enabled && !localEnabledByEnv) {
          console.warn(
            "[LoginForm] API habilitou login local, mas frontend não detectou staging. Usando decisão da API.",
          );
        }
      } catch (err) {
        // Se a API falhar, usar a verificação local do frontend como fallback
        setLocalLoginAvailable(localEnabledByEnv);
      }
    };
    checkAuthMethods();

    // Verificar se há erro vindo da URL (callback SSO)
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(errorParam);
    }
  }, [searchParams]);

  const handleSSOLogin = () => {
    setSsoLoading(true);
    setError("");
    // Redirecionar para o endpoint de login SSO (usa URL detectada automaticamente).
    // returnUrl = deep link guardado (volta à página pretendida após o callback do SSO).
    const returnUrl = destinoPosLogin();
    const targetUrl = `${API_BASE_URL}/api/auth/sso/login?returnUrl=${encodeURIComponent(returnUrl)}`;

    // Fallback: caso a navegação não ocorra (URL inválida / bloqueio / erro), reabilita o botão
    window.setTimeout(() => {
      setSsoLoading(false);
    }, 2500);

    window.location.assign(targetUrl);
  };

  // Helper para hash SHA-256 (compatível com backend)
  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex;
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email e senha são obrigatórios");
      return;
    }

    setLocalLoading(true);

    try {
      // Hash da senha usando SHA-256 (Web Crypto API)
      const passwordHash = await hashPassword(password);

      // Chamar endpoint de login local
      const response = await apiClient.post<{
        user: any;
        accessToken: string;
        expiresAt: number;
      }>("/api/auth/local/login", {
        email,
        password: passwordHash,
      });

      // Salvar dados no localStorage
      localStorage.setItem("auth_token", response.accessToken);
      localStorage.setItem("token_expires_at", response.expiresAt.toString());
      Storage.save("user", response.user);
      localStorage.removeItem("is_sso_user"); // Marcar como login local

      // Volta ao deep link guardado (ou à home). Reload força o AuthContext a reidratar.
      window.location.href = destinoPosLogin();
    } catch (err: any) {
      setError(
        err.message || "Erro ao fazer login. Verifique suas credenciais.",
      );
    } finally {
      setLocalLoading(false);
    }
  };

  // Debug log

  return (
    <div
      className="lk relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4"
      style={{
        background:
          "radial-gradient(1100px 620px at 50% -12%, #16558f 0%, #0E3D73 34%, #0B2547 72%, #0A1E38 100%)",
      }}
    >
      <style>{LOGIN_CSS}</style>

      {/* Textura pontilhada sutil no fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, #ffffff 0 1px, transparent 1.4px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="lk-card relative w-full max-w-[420px] rounded-[26px] bg-white px-8 pb-7 pt-9 shadow-[0_40px_90px_-24px_rgba(4,18,42,0.7)]">
        {/* Emblema — balança da justiça com o anel de ciano (mesma da Home) */}
        <div className="flex flex-col items-center text-center">
          <div className="lk-sym relative mb-5 h-[128px] w-[128px]">
            <div
              className="lk-halo absolute inset-[8%] rounded-full blur-xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(30,155,215,0.22), transparent 62%)",
              }}
            />
            <svg
              viewBox="0 0 400 400"
              className="absolute inset-0 h-full w-full"
              aria-hidden
            >
              <circle
                className="lk-ring"
                cx="200"
                cy="200"
                r="192"
                fill="none"
                stroke="#1E9BD7"
                strokeWidth="3"
                strokeDasharray="5 13"
                strokeLinecap="round"
              />
            </svg>
            <img
              src="/logo%20kaizen%20desenho.png"
              alt="Kaizen — balança da justiça no ciclo de melhoria contínua"
              className="absolute inset-[16%] h-[68%] w-[68%] object-contain"
              style={{ transform: "translate(1.6%, 4.9%)" }}
            />
          </div>

          <h1
            className="lk-word text-[2.7rem] font-extrabold uppercase leading-none tracking-[0.02em]"
            style={{ color: "#0E3D73" }}
          >
            Kaizen
          </h1>
          <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#5A6B84]">
            Governança Judiciária e Tecnológica
          </p>
        </div>

        <div className="my-6 h-px w-full bg-slate-100" />

        {error && (
          <Alert
            variant="destructive"
            className="mb-4 animate-in fade-in-50 duration-300"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Toggle SSO / Login Local (só quando ambos disponíveis) */}
        {localLoginAvailable && ssoEnabled && (
          <div className="mb-4 flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setUseLocalLogin(false)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                !useLocalLogin
                  ? "bg-white text-[#0E3D73] shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Shield className="mr-1 inline-block h-4 w-4" />
              SSO
            </button>
            <button
              type="button"
              onClick={() => setUseLocalLogin(true)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                useLocalLogin
                  ? "bg-white text-[#0E3D73] shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Lock className="mr-1 inline-block h-4 w-4" />
              Login Local
            </button>
          </div>
        )}

        {/* Login SSO */}
        {ssoEnabled && (!useLocalLogin || !localLoginAvailable) && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleSSOLogin}
              disabled={ssoLoading}
              className="lk-cta flex h-14 w-full items-center justify-center gap-2.5 rounded-xl text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                background: "linear-gradient(90deg, #0E3D73 0%, #1478B4 100%)",
              }}
            >
              {ssoLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Redirecionando...
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5" />
                  Entrar com Conta Institucional (SSO)
                </>
              )}
            </button>
            <p className="text-center text-xs text-slate-500">
              Use suas credenciais do TJGO
            </p>
          </div>
        )}

        {/* Login Local (dev/staging) */}
        {localLoginAvailable && (useLocalLogin || !ssoEnabled) && (
          <form onSubmit={handleLocalLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@tjgo.jus.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl transition-all duration-200 focus:ring-2 focus:ring-[#1478B4]"
                autoComplete="email"
                autoFocus
                disabled={localLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl transition-all duration-200 focus:ring-2 focus:ring-[#1478B4]"
                autoComplete="current-password"
                disabled={localLoading}
              />
            </div>
            <button
              type="submit"
              disabled={localLoading}
              className="lk-cta flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                background: "linear-gradient(90deg, #0E3D73 0%, #1478B4 100%)",
              }}
            >
              {localLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  Entrar
                </>
              )}
            </button>
            <p className="text-center text-xs text-amber-600">
              Login local disponível apenas em desenvolvimento
            </p>
          </form>
        )}

        {/* Nenhum método disponível */}
        {!ssoEnabled && !localLoginAvailable && (
          <Alert
            variant="destructive"
            className="animate-in fade-in-50 duration-300"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum método de autenticação está disponível no momento.
            </AlertDescription>
          </Alert>
        )}

        {/* Rodapé institucional sutil */}
        <div className="mt-7 flex items-center justify-center gap-2.5 border-t border-slate-100 pt-5">
          <img
            src="/brasao-goias.png"
            alt="Brasão de Goiás"
            className="h-9 w-auto object-contain"
          />
          <div className="text-left leading-tight">
            <p className="text-[11px] font-semibold text-slate-600">
              PODER JUDICIÁRIO · TJGO
            </p>
            <p className="text-[10px] text-slate-400">
              Secretaria de Governança Judiciária e Tecnológica
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
