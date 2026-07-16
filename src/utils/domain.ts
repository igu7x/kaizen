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

  if (isSuperAdmin(user)) return true;

  if (areas && areas.length > 0 && user?.cadastrosAreasId) {
    const area = areas.find((a) => a.id === user.cadastrosAreasId);
    if (area && area.is_domain_root === true) return true;
  }

  if ((user as any).is_domain_root === true) return true;
  return false;
}

export function getUserDominio(user: User | null, areas?: Area[]): string {
  if (!user) return "SGJT";

  if ((user as any)?.dominio) return (user as any).dominio;

  if (areas) {
    const userAreaId = user?.cadastrosAreasId;
    if (userAreaId) {
      const area = areas.find((a) => a.id === userAreaId);
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
