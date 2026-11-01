import { areaOf, resolveAccess } from "@/lib/user-permissions";

export type Role = "owner" | "manager" | "employee" | "contractor";

export type NavItem = {
  slug: string; // route key
  href: string;
  label: string;
  roles: Role[];
  icon: string; // key into ICONS
};

export type NavGroup = { title: string; items: NavItem[] };

const ALL: Role[] = ["owner", "manager", "employee", "contractor"];
const STAFF_MGMT: Role[] = ["owner", "manager"];

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Dagleg vinna",
    items: [
      { slug: "dashboard", href: "/maelabord", label: "Mælaborð", roles: STAFF_MGMT, icon: "dashboard" },
      { slug: "schedule", href: "/vaktaplan", label: "Vaktaplan", roles: STAFF_MGMT, icon: "schedule" },
      { slug: "attendance", href: "/timaskraning", label: "Tímaskráning", roles: STAFF_MGMT, icon: "clock" },
      { slug: "jobs", href: "/verk", label: "Verk", roles: ["owner", "manager", "contractor"], icon: "briefcase" },
    ],
  },
  {
    title: "Laun & fólk",
    items: [
      { slug: "payroll", href: "/launakeyrslur", label: "Launakeyrslur", roles: ["owner"], icon: "payroll" },
      { slug: "employees", href: "/starfsfolk", label: "Starfsfólk", roles: STAFF_MGMT, icon: "people" },
    ],
  },
  {
    title: "Greining",
    items: [
      { slug: "insights", href: "/innsyn", label: "Innsýn", roles: STAFF_MGMT, icon: "trend" },
    ],
  },
  {
    title: "Mitt",
    items: [
      // Owners and managers work shifts too, so everyone has Mitt svæði.
      { slug: "employeeapp", href: "/mitt-svaedi", label: "Mitt svæði", roles: ALL, icon: "phone" },
      // Read-only schedule for the whole team (Sling-style transparency).
      { slug: "myplan", href: "/planid", label: "Planið", roles: ALL, icon: "schedule" },
      { slug: "feed", href: "/frettaveita", label: "Fréttaveita", roles: ALL, icon: "megaphone" },
      { slug: "chat", href: "/spjall", label: "Spjall", roles: ALL, icon: "chat" },
    ],
  },
];

export const FOOT_ITEMS: NavItem[] = [
  { slug: "settings", href: "/stillingar", label: "Stillingar", roles: STAFF_MGMT, icon: "settings" },
  { slug: "help", href: "/hjalp", label: "Hjálp", roles: ALL, icon: "help" },
];

/** Atriði sem hlutverkið sér. Stjórnandi: stjórnendasvæðin fara eftir users.permissions (0095),
 * sama regla og canAccess() í middleware — null = sjálfgefið fyrir hlutverkið. */
/** Verktakahamur (0102): aðeins það sem einyrki/verktaki notar. */
const SOLO_SLUGS = new Set(["jobs", "chat", "settings", "help"]);

export function visibleFor(role: Role, perms?: unknown, solo = false) {
  const access = role === "manager" ? resolveAccess(role, perms) : null;
  const shows = (i: NavItem) => {
    if (solo) return SOLO_SLUGS.has(i.slug) && i.roles.includes(role);
    const area = access ? areaOf(i.href) : null;
    return access && area ? access[area] : i.roles.includes(role);
  };
  const groups = NAV_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter(shows),
  })).filter((g) => g.items.length > 0);
  const foot = FOOT_ITEMS.filter(shows);
  return { groups, foot };
}
