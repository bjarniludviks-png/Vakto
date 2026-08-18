// Loads the current employee once after login and shares it with every screen.
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMe, type Me } from "./api/me";
import { useAuth } from "./auth";

type MeState = {
  me: Me | null;
  loading: boolean;
  reload: () => Promise<void>;
};

const MeCtx = createContext<MeState>({ me: null, loading: true, reload: async () => {} });

export function MeProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!session) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setMe(await getMe());
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    reload();
  }, [reload]);

  return <MeCtx.Provider value={{ me, loading, reload }}>{children}</MeCtx.Provider>;
}

export function useMe() {
  return useContext(MeCtx);
}
