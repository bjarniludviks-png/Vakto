# Brand logos (integration partners + customers)

The homepage logo walls (integrations under "Tengingar", customers in the trust
strip) are driven by `INTEGRATIONS` and `CUSTOMERS` in `src/app/home-data.ts`.

Until a real logo file exists, each brand renders as a tasteful typographic
**wordmark**. To show the real logo instead:

1. Drop the official file here, named after the brand `slug`, e.g.
   - `public/logos/payday.svg`
   - `public/logos/dk.svg`
   - `public/logos/dineout.svg`
   - `public/logos/salescloud.svg`
   - `public/logos/beint-ur-sjo.svg`  (customers use the same mechanism)
   SVG is preferred; PNG works too (use a transparent background, ideally the
   monochrome/dark version — the wall applies a grayscale filter, full colour on hover).

2. In `src/app/home-data.ts`, set that brand's `img` field to the path:
   ```ts
   { name: "Payday", slug: "payday", img: "/logos/payday.svg" },
   ```

That's it — the wall swaps the wordmark for the real asset. Recommended asset
height ~27px; width auto.

> Only display a customer's logo with their permission.
