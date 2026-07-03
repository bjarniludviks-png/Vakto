"use client";

import { createContext, useContext } from "react";
import { normCountry, type Country } from "@/lib/country";

const Ctx = createContext<Country>("IS");

export function CountryProvider({ value, children }: { value?: string | null; children: React.ReactNode }) {
  return <Ctx.Provider value={normCountry(value)}>{children}</Ctx.Provider>;
}

/** Current company country. `isIS` for the common Icelandic-vs-standardized gate. */
export function useCountry(): { country: Country; isIS: boolean } {
  const country = useContext(Ctx);
  return { country, isIS: country === "IS" };
}
