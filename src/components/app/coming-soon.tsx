import { PageHeader } from "./page-header";

export function ComingSoon({
  title,
  subtitle,
  note,
}: {
  title: string;
  subtitle?: string;
  note?: string;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div
        className="card"
        style={{ marginTop: 6, padding: "40px 28px", textAlign: "center" }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          {title} — í smíðum
        </div>
        <p
          className="muted"
          style={{ fontSize: 13, marginTop: 8, maxWidth: 460, marginInline: "auto" }}
        >
          {note ??
            "Þessi skjár er hannaður í prótótýpunni og verður byggður næst. Fasi 1 byrjar á innskráningu, gagnagrunni og starfsfólki."}
        </p>
      </div>
    </>
  );
}
