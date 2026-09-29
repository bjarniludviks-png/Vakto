// The miðnætursól sky behind the login + signup panels: drifting stars,
// moving sun-ray shafts and the glowing horizon. Shared so both pages match.
export default function Sky() {
  return (
    <span className="sky" aria-hidden>
      <i className="st s1" />
      <i className="st s2" />
      <i className="ry r1" />
      <i className="ry r2" />
      <i className="ry r3" />
      <i className="hz" />
    </span>
  );
}
