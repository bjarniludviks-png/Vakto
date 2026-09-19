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
      // The employee experience is exactly three things (everyone works shifts,
      // so owners and managers get them too): clock, shifts, pay & chat.
      { slug: "clock", href: "/stimpla", label: "Stimpla", roles: ALL, icon: "kclock" },
      { slug: "myshifts", href: "/vaktir", label: "Vaktir", roles: ALL, icon: "schedule" },
      { slug: "mine", href: "/mitt", label: "Laun & spjall", roles: ALL, icon: "chat" },
    ],
  },
];

export const FOOT_ITEMS: NavItem[] = [
  { slug: "settings", href: "/stillingar", label: "Stillingar", roles: STAFF_MGMT, icon: "settings" },
];
// Routes that are not in the sidebar but still role-guarded (deep links from push etc.).
export const EXTRA_ROUTES: { href: string; roles: Role[] }[] = [
  { href: "/hjalp", roles: ALL }, { href: "/spjall", roles: ALL }, { href: "/frettaveita", roles: ALL },
];

export function visibleFor(role: Role) {
  const groups = NAV_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
  const foot = FOOT_ITEMS.filter((i) => i.roles.includes(role));
  return { groups, foot };
}
