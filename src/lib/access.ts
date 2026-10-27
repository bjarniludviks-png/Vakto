// VAKTO — route-level access control (brief §5).
// Source of truth = the sidebar nav roles (prototype wins over the brief where
// they differ, per CLAUDE.md). Owner is a superuser (also enables the owner's
// "view as role" preview to reach employee/contractor screens).
// Stjórnendur (manager): aðgangur að stjórnendasvæðum fer eftir users.permissions (0095)
// — sjá lib/user-permissions.ts. permissions null = sama og fasta fylkið áður.
import { NAV_GROUPS, FOOT_ITEMS, type Role } from "@/components/app/nav";
import { AREAS, areaOf, resolveAccess } from "@/lib/user-permissions";

// Build href -> allowed-roles from the nav definition.
const ROUTE_ROLES: Record<string, Role[]> = (() => {
  const map: Record<string, Role[]> = {};
  for (const g of NAV_GROUPS) for (const i of g.items) map[i.href] = i.roles;
  for (const i of FOOT_ITEMS) map[i.href] = i.roles;
  return map;
})();

/** Can this role open this app route? Owner = full access. Unknown routes allowed.
 * `perms` = users.permissions (aðeins notað fyrir stjórnendur). */
export function canAccess(role: Role, pathname: string, perms?: unknown): boolean {
  if (role === "owner") return true;
  const match = Object.keys(ROUTE_ROLES).find(
    (href) => pathname === href || pathname.startsWith(href + "/"),
  );
  if (!match) return true; // not a guarded app route
  const area = areaOf(match);
  if (role === "manager" && area) return resolveAccess(role, perms)[area];
  return ROUTE_ROLES[match].includes(role);
}

/** Where to send a role that hits a route it may not access. Stjórnandi án Mælaborðs
 * fer á fyrsta svæðið sem hann má opna (annars Mitt svæði) — aldrei hringrás. */
export function homeFor(role: Role, perms?: unknown): string {
  if (role === "employee" || role === "contractor") return "/mitt-svaedi";
  if (role === "manager") {
    const access = resolveAccess(role, perms);
    const first = AREAS.find((a) => access[a.key]);
    return first ? "/" + first.key : "/mitt-svaedi";
  }
  return "/maelabord";
}
