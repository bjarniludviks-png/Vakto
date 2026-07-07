import NyClient from "./ny/ny-client";
import "./ny/ny.css";

// The "miðnætursól" aurora homepage — approved by the owner and promoted from
// the /ny preview route to the root (vakto.is). Metadata inherits from layout.
export default function Page() {
  return <NyClient />;
}
