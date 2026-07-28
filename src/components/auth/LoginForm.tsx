import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Shield, Lock } from "lucide-react";
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
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #0A2547 0%, #1565C0 100%)",
      }}
    >
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-6 text-center pb-2">
          {/* Header Institucional */}
          <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
            <img
              src="/brasao-goias.png"
              alt="Brasão de Goiás"
              className="h-20 w-auto object-contain"
            />
            <div className="text-left flex-1">
              <p className="text-xs text-gray-700 leading-relaxed">
                <strong className="text-gray-900">PODER JUDICIÁRIO</strong>
                <br />
                Tribunal de Justiça do Estado de Goiás
                <br />
                <span className="text-gray-500 text-[10px]">
                  Diretoria de Soluções em Tecnologia da Informação
                  <br />
                  Coordenadoria de Transformação Digital
                </span>
              </p>
              <p className="text-sm font-semibold text-blue-700 mt-2 leading-tight">
                Secretaria de Governança
                <br />
                Judiciária e Tecnológica
              </p>
            </div>
          </div>

          {/* Título Kaizen */}
          <div className="pt-2">
            <CardTitle
              className="text-4xl font-bold tracking-wide"
              style={{
                color: "#0A2547",
                fontFamily: "'Segoe UI', 'Roboto', sans-serif",
              }}
            >
              Kaizen
            </CardTitle>
            <CardDescription className="text-base text-gray-600 mt-1">
              Plataforma de Governança Judiciária e Tecnológica
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert
              variant="destructive"
              className="animate-in fade-in-50 duration-300 mb-4"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Toggle entre SSO e Login Local (apenas quando ambos disponíveis) */}
          {localLoginAvailable && ssoEnabled && (
            <div className="mb-4 flex items-center justify-center gap-2 p-2 bg-gray-50 rounded-lg">
              <button
                type="button"
                onClick={() => setUseLocalLogin(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  !useLocalLogin
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Shield className="inline-block w-4 h-4 mr-1" />
                SSO
              </button>
              <button
                type="button"
                onClick={() => setUseLocalLogin(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  useLocalLogin
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Lock className="inline-block w-4 h-4 mr-1" />
                Login Local
              </button>
            </div>
          )}

          {/* Login SSO (mostra se SSO habilitado E (não usa local OU local não disponível)) */}
          {ssoEnabled && (!useLocalLogin || !localLoginAvailable) && (
            <div className="space-y-3">
              <Button
                type="button"
                onClick={handleSSOLogin}
                className="w-full h-14 text-base font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                disabled={ssoLoading}
              >
                {ssoLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Redirecionando...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-5 w-5" />
                    Entrar com Conta Institucional (SSO)
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-gray-500">
                Use suas credenciais do TJGO
              </p>
            </div>
          )}

          {/* Login Local (dev/staging) - mostra se local disponível E (usa local OU SSO não disponível) */}
          {localLoginAvailable && (useLocalLogin || !ssoEnabled) && (
            <form onSubmit={handleLocalLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.email@tjgo.jus.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                  autoComplete="email"
                  autoFocus
                  disabled={localLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                  autoComplete="current-password"
                  disabled={localLoading}
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                disabled={localLoading}
              >
                {localLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-5 w-5" />
                    Entrar
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-amber-600">
                Login local disponível apenas em desenvolvimento
              </p>
            </form>
          )}

          {/* SSO não disponível */}
          {!ssoEnabled && !localLoginAvailable && (
            <div className="space-y-4">
              <Alert
                variant="destructive"
                className="animate-in fade-in-50 duration-300"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum método de autenticação está disponível no momento.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
