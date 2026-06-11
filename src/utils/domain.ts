import { User } from "@/types";
import { Area } from "@/services/areasApi";

/**
 * Check if user is a SUPERADMIN (can see all diretorias).
 * Replaces the old SGJT-as-root behavior.
 */
export function isSuperAdmin(user: User | null): boolean {
  if (!user) return false;
  return (user as any).is_superadmin === true;
}

/**
 * Check if user is a domain root (admin of their domain).
 * Uses is_domain_root from user data (set during login/SSO).
 * Falls back to checking against areas list if user data doesn't have the field.
 * NOTE: SUPERADMIN is always considered domain root.
 */
export function isDomainRoot(user: User | null, areas?: Area[]): boolean {
  if (!user) return false;

  // SUPERADMIN always has domain root powers
  if (isSuperAdmin(user)) return true;

  // Primary: check areas list (source of truth from cadastros_areas table)
  if (areas && areas.length > 0) {
    const userDiretoria = (user as any)?.diretoria;
    if (userDiretoria) {
      const area = areas.find((a) => (a.sigla || a.nome) === userDiretoria);
      if (area) return area.is_domain_root === true;
    }
  }

  // Fallback: use is_domain_root from user/SSO data
  if ((user as any).is_domain_root === true) return true;
  if ((user as any).is_domain_root === false) return false;

  return false;
}

/**
 * Get the domain name for the user.
 * If user.dominio is not set, falls back to looking up the user's diretoria in the areas list.
 */
export function getUserDominio(user: User | null, areas?: Area[]): string {
  if (!user) return "SGJT";

  // Primary: use dominio from user data
  if ((user as any)?.dominio) return (user as any).dominio;

  // Fallback: look up diretoria in areas list
  if (areas) {
    const userDiretoria = (user as any)?.diretoria;
    if (userDiretoria) {
      const area = areas.find((a) => (a.sigla || a.nome) === userDiretoria);
      if (area?.dominio) return area.dominio;
    }
  }

  return "SGJT";
}

/**
 * Filter areas to only those in the user's domain.
 */
export function getAreasInDomain(areas: Area[], user: User | null): Area[] {
  const dominio = getUserDominio(user, areas);
  return areas.filter((a) => a.dominio === dominio);
}
