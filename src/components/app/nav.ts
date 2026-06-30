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
      { slug: "reports", href: "/skyrslur", label: "Skýrslur", roles: STAFF_MGMT, icon: "reports" },
      { slug: "performance", href: "/frammistada", label: "Frammistaða", roles: ["owner"], icon: "trend" },
    ],
  },
  {
    title: "Starfsmaður",
    items: [
      { slug: "employeeapp", href: "/mitt-svaedi", label: "Starfsmannaapp", roles: ["employee", "contractor"], icon: "phone" },
      { slug: "chat", href: "/spjall", label: "Spjall", roles: ALL, icon: "chat" },
    ],
  },
];

export const FOOT_ITEMS: NavItem[] = [
  { slug: "settings", href: "/stillingar", label: "Stillingar", roles: STAFF_MGMT, icon: "settings" },
  { slug: "help", href: "/hjalp", label: "Hjálp", roles: ALL, icon: "help" },
];

export function visibleFor(role: Role) {
  const groups = NAV_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
  const foot = FOOT_ITEMS.filter((i) => i.roles.includes(role));
  return { groups, foot };
}
