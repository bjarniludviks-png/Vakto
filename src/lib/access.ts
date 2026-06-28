// VAKTO — route-level access control (brief §5).
// Source of truth = the sidebar nav roles (prototype wins over the brief where
// they differ, per CLAUDE.md). Owner is a superuser (also enables the owner's
// "view as role" preview to reach employee/contractor screens).
import { NAV_GROUPS, FOOT_ITEMS, type Role } from "@/components/app/nav";

// Build href -> allowed-roles from the nav definition.
const ROUTE_ROLES: Record<string, Role[]> = (() => {
  const map: Record<string, Role[]> = {};
  for (const g of NAV_GROUPS) for (const i of g.items) map[i.href] = i.roles;
  for (const i of FOOT_ITEMS) map[i.href] = i.roles;
  return map;
})();

/** Can this role open this app route? Owner = full access. Unknown routes allowed. */
export function canAccess(role: Role, pathname: string): boolean {
  if (role === "owner") return true;
  const match = Object.keys(ROUTE_ROLES).find(
    (href) => pathname === href || pathname.startsWith(href + "/"),
  );
  if (!match) return true; // not a guarded app route
  return ROUTE_ROLES[match].includes(role);
}

/** Where to send a role that hits a route it may not access. */
export function homeFor(role: Role): string {
  return role === "employee" || role === "contractor" ? "/mitt-svaedi" : "/maelabord";
}
