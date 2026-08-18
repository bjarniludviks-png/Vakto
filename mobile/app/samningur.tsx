// Ráðningarsamningur — sýnir nýjasta sendan/undirritaðan samning.
import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Screen } from "../src/components/screen";
import { Card, Txt, Muted, Pill } from "../src/components/ui";
import { useMe } from "../src/lib/me-context";
import { getMyContract, type Contract } from "../src/lib/api/docs";

/** Very light markdown → text: strip #, **, keep line structure. */
function plain(md: string): string {
  return md
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^[-*]\s+/gm, "• ");
}

export default function Samningur() {
  const { me } = useMe();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    setContract(await getMyContract(me));
    setLoaded(true);
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen title="Ráðningarsamningur" back>
      {loaded && !contract ? (
        <Card>
          <Muted>Enginn samningur hefur verið sendur á þig ennþá.</Muted>
        </Card>
      ) : null}
      {contract ? (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Txt weight="semibold" size={16}>
              {contract.title}
            </Txt>
            <Pill
              label={contract.status === "signed" ? "Undirritaður" : "Bíður undirritunar"}
              tone={contract.status === "signed" ? "good" : "warn"}
            />
          </View>
          {contract.signedAt ? <Muted size={12}>Undirritað {contract.signedAt.slice(0, 10)}</Muted> : null}
          <Txt size={13} style={{ lineHeight: 20 }}>
            {plain(contract.content)}
          </Txt>
          {contract.status !== "signed" ? (
            <Muted size={12}>Undirritun fer fram á vefnum (vakto.is) að sinni.</Muted>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}
