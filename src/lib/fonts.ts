import { Black_Ops_One, Radio_Canada_Big } from "next/font/google";

// Shared across the navbar wordmark (applied directly via className) and
// every h1/h2/h3 in the app (applied globally via the CSS variable in
// globals.css) — one font instance so next/font only bundles the subset
// once instead of duplicating it per call site.
export const blackOpsOne = Black_Ops_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-black-ops-one",
});

// Body copy site-wide (applied via the CSS variable in globals.css).
export const radioCanadaBig = Radio_Canada_Big({
  weight: "variable",
  subsets: ["latin"],
  variable: "--font-radio-canada-big",
});
