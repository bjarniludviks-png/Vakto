"use client";

import { createContext, useContext } from "react";

// Prófílmyndir starfsfólks (employees.photo_url), sóttar einu sinni í app-layout.
// Hringir um allt kerfið sýna myndina ef hún er til, annars upphafsstafi í lit manneskjunnar.
const PhotoCtx = createContext<Record<string, string>>({});

export function PhotoProvider({ photos, children }: { photos: Record<string, string>; children: React.ReactNode }) {
  return <PhotoCtx.Provider value={photos}>{children}</PhotoCtx.Provider>;
}

export function usePhoto(id?: string | null): string | undefined {
  const photos = useContext(PhotoCtx);
  return id ? photos[id] : undefined;
}

export function Av({ id, av, c, className = "db2-av sm", title, style }: { id?: string | null; av: string; c?: string; className?: string; title?: string; style?: React.CSSProperties }) {
  const photo = usePhoto(id);
  return (
    <span className={`${className}${photo ? " has-photo" : ""}`} style={{ background: c, ...style }} title={title}>
      {photo ? <img src={photo} alt="" loading="lazy" /> : av}
    </span>
  );
}
