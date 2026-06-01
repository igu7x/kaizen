/**
 * Utilitário para detectar o ambiente da aplicação
 */

export type Environment = 'development' | 'staging' | 'production';

/**
 * Detecta o ambiente atual baseado no hostname ou variáveis de ambiente
 */
export const getEnvironment = (): Environment => {
  // Verifica variável de ambiente primeiro
  const viteEnv = import.meta.env.VITE_APP_ENV?.toLowerCase();
  if (viteEnv === 'staging') return 'staging';
  if (viteEnv === 'production') return 'production';
  if (viteEnv === 'development') return 'development';

  // Detecta pelo hostname
  const hostname = window.location.hostname;

  // Staging
  if (hostname.includes('stag') && hostname.includes('tjgo.jus.br')) {
    return 'staging';
  }

  // Production
  if (hostname.includes('kaizen.tjgo.jus.br') ||
      (hostname.includes('tjgo.jus.br') && !hostname.includes('stag'))) {
    return 'production';
  }

  // Development (localhost ou qualquer outro)
  return 'development';
};

/**
 * Verifica se está em ambiente de desenvolvimento
 */
export const isDevelopment = (): boolean => {
  return getEnvironment() === 'development';
};

/**
 * Verifica se está em ambiente de staging
 */
export const isStaging = (): boolean => {
  return getEnvironment() === 'staging';
};

/**
 * Verifica se está em ambiente de produção
 */
export const isProduction = (): boolean => {
  return getEnvironment() === 'production';
};

/**
 * Verifica se login local deve estar habilitado
 * (apenas em development e staging)
 */
export const isLocalLoginEnabled = (): boolean => {
  const env = getEnvironment();
  return env === 'development' || env === 'staging';
};

/**
 * Módulo de competências padrão (versionamento) liberado também em produção —
 * funciona exatamente como em staging. Função mantida pra preservar os pontos
 * de chamada existentes e evitar mudanças colaterais.
 */
export const isCompetenciasPadraoEnabled = (): boolean => {
  return true;
};
