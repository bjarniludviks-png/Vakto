import type { Metadata } from "next";
import NyClient from "./ny-client";
import "./ny.css";

// PREVIEW route — a candidate homepage redesign ("miðnætursól" / aurora style,
// inspired by the owner's reference). Not linked from anywhere and noindexed;
// the real homepage at / stays untouched until the owner approves.
export const metadata: Metadata = {
  title: "VAKTO — ný heimasíða (prufa)",
  robots: { index: false, follow: false },
};

export default function NyPage() {
  return <NyClient />;
}
