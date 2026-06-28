"use client";

import { useLang } from "./lang";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const { t } = useLang();
  return (
    <div className="ph">
      <div>
        <h1 className="h1">{t(title)}</h1>
        {subtitle && <div className="phsub">{t(subtitle)}</div>}
      </div>
      {actions && <div className="phact">{actions}</div>}
    </div>
  );
}
