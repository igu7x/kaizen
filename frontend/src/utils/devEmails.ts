// Whitelist de e-mails com acesso ao modulo "Desenvolvimento" e features dev-only
// (banner DEV, seletor de ambiente, etc). Mantenha sincronizado com
// backend/src/main/java/br/jus/tjgo/kaizen/controller/AmbientesController.java -> DEV_EMAILS.
export const DEV_EMAILS = [
  'ifccupertino@tjgo.jus.br',
  'acandrade@tjgo.jus.br',
  'sgrocha@tjgo.jus.br',
];

export const isDevEmail = (email?: string | null): boolean =>
  !!email && DEV_EMAILS.includes(email);
