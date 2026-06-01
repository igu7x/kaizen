/**
 * INSTRUÇÕES PARA INTEGRAR VALIDAÇÃO NO AuthContext
 * 
 * Este arquivo contém as alterações necessárias para integrar
 * a validação de usuário no AuthContext.tsx
 */

// ============================================================
// PASSO 1: Adicionar imports (já feito)
// ============================================================
/*
import { 
  validateAndFixLocalStorageUser, 
  validateLoginResponse, 
  syncUserDiretoria,
  debugUserValidation 
} from '@/utils/userValidator';
*/

// ============================================================
// PASSO 2: Atualizar useEffect (linhas 19-39)
// ============================================================
/*
SUBSTITUIR:
  useEffect(() => {
    const savedUser = Storage.load<User | null>('user', null);
    const token = localStorage.getItem('auth_token');
    const isSsoUser = localStorage.getItem('is_sso_user') === 'true';
    
    if (savedUser) {
      setUser(savedUser);
      
      if (isSsoUser && token) {
        const expiresAt = localStorage.getItem('token_expires_at');
        if (expiresAt && Date.now() > parseInt(expiresAt)) {
          refreshSsoToken();
        }
      }
    }
    setLoading(false);
  }, []);

POR:
  useEffect(() => {
    // Validar e corrigir dados do usuário do localStorage
    const validation = validateAndFixLocalStorageUser();
    
    if (validation && validation.isValid && validation.user) {
      const token = localStorage.getItem('auth_token');
      const isSsoUser = localStorage.getItem('is_sso_user') === 'true';
      
      setUser(validation.user);
      
      // Se for usuário SSO, verificar se o token ainda é válido
      if (isSsoUser && token) {
        const expiresAt = localStorage.getItem('token_expires_at');
        if (expiresAt && Date.now() > parseInt(expiresAt)) {
          refreshSsoToken();
        }
      }
    } else if (validation && !validation.isValid) {
      console.error('[AuthContext] Dados de usuário inválidos:', validation.errors);
      handleLogout();
    }
    
    setLoading(false);
  }, []);
*/

// ============================================================
// PASSO 3: Atualizar função login (linhas 67-77)
// ============================================================
/*
SUBSTITUIR:
  const login = async (email: string, password: string): Promise<void> => {
    try {
      const loggedUser = await api.login(email, password);
      
      if (!loggedUser) {
        throw new Error('Credenciais inválidas');
      }

      setUser(loggedUser);
      Storage.save('user', loggedUser);
      localStorage.removeItem('is_sso_user');
    } catch (error) {
      // ... resto do código

POR:
  const login = async (email: string, password: string): Promise<void> => {
    try {
      const loggedUser = await api.login(email, password);
      
      if (!loggedUser) {
        throw new Error('Credenciais inválidas');
      }

      // Validar e sincronizar dados do usuário
      const validatedUser = validateLoginResponse(loggedUser);

      setUser(validatedUser);
      Storage.save('user', validatedUser);
      localStorage.removeItem('is_sso_user');
    } catch (error) {
      // ... resto do código
*/

// ============================================================
// BENEFÍCIOS DESTA INTEGRAÇÃO
// ============================================================
/*
1. ✅ Validação automática ao carregar usuário do localStorage
2. ✅ Sincronização automática de diretoria/directorate_code
3. ✅ Detecção e correção de inconsistências
4. ✅ Logout automático se dados estiverem corrompidos
5. ✅ Validação ao fazer login
6. ✅ Logs detalhados para debug
*/

export const INTEGRATION_INSTRUCTIONS = `
COMO INTEGRAR:

1. Abra o arquivo: frontend/src/contexts/AuthContext.tsx

2. Os imports já foram adicionados (linhas 6-11)

3. Substitua o useEffect (linhas 19-39) pelo código acima

4. Substitua a função login (linhas 67-77) pelo código acima

5. Teste fazendo login e verificando o console

VERIFICAÇÃO:
- Ao fazer login, deve aparecer no console (em dev): "User Validation Debug"
- Se houver inconsistências, serão corrigidas automaticamente
- Usuários com dados inválidos serão deslogados automaticamente
`;
