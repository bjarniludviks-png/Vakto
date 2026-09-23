// Samstarfsfólk — listi yfir alla á vinnustaðnum, með skilaboðahnappi.
import React, { useCallback, useState } from "react";
import { useTheme } from "../src/theme";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "../src/components/screen";
import { List, Row, Avatar, Muted } from "../src/components/ui";
import { useMe } from "../src/lib/me-context";
import { supabase } from "../src/lib/supabase";

type Emp = { id: string; name: string; role: string | null; dept: string | null; color: string | null; photo: string | null };

export default function Samstarfsfolk() {
  useTheme();
  const { me } = useMe();
  const router = useRouter();
  const [emps, setEmps] = useState<Emp[]>([]);
  useFocusEffect(useCallback(() => {
    if (!me) return;
    supabase.from("employees").select("id, full_name, title, avatar_color, photo_url, positions(name), departments(name)").eq("company_id", me.companyId).eq("status", "active").order("full_name").then(({ data }) => {
      setEmps((data ?? []).filter((e) => e.id !== me.empId).map((e) => {
        const pos = (Array.isArray(e.positions) ? e.positions[0] : e.positions) as { name?: string } | null;
        const dep = (Array.isArray(e.departments) ? e.departments[0] : e.departments) as { name?: string } | null;
        return { id: e.id, name: e.full_name, role: e.title ?? pos?.name ?? null, dept: dep?.name ?? null, color: e.avatar_color, photo: e.photo_url };
      }));
    });
  }, [me]));
  const groups = new Map<string, Emp[]>();
  for (const e of emps) groups.set(e.dept ?? "Annað", [...(groups.get(e.dept ?? "Annað") ?? []), e]);
  return (
    <Screen title="Samstarfsfólk" back>
      {[...groups.entries()].map(([dept, list]) => (
        <List key={dept}>
          <Muted style={{ paddingHorizontal: 14, paddingTop: 10 }}>{dept}</Muted>
          {list.map((e, i) => <Row key={e.id} icon={<Avatar name={e.name} size={38} color={e.color} photo={e.photo} />} title={e.name} sub={e.role ?? "Starfsmaður"} onPress={() => router.push(`/starfsmadur/${e.id}`)} last={i === list.length - 1} />)}
        </List>
      ))}
    </Screen>
  );
}
