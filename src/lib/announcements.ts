import type { Announcement, Partner } from "./domain";

export const REGION_COUNTRIES: Record<string, string[]> = {
  "APAC region": ["India", "Japan", "Vietnam", "China", "South Korea", "UAE"],
  "EMEA region": [
    "Nigeria",
    "Italy",
    "United Kingdom",
    "Germany",
    "Portugal",
    "Norway",
    "Spain",
    "Israel",
    "France",
    "Sweden",
    "Turkey",
    "Egypt",
    "Denmark",
    "UAE",
  ],
  "Americas region": ["USA", "Brazil", "Mexico", "Chile"],
};

export function isAnnouncementTargeted(a: Announcement, partner?: Partner) {
  if (!partner) return false;
  if (
    [
      "All Sales Partners",
      "All partners",
      "all_partners",
      "All Portal Partners",
      "All portal users",
      "all_users",
    ].includes(a.target)
  )
    return true;
  // Canonical database targets are already filtered for partners by Supabase RLS.
  if (["region", "selected_partners"].includes(a.target)) return true;
  if (REGION_COUNTRIES[a.target]?.includes(partner.country)) return true;
  if (
    a.target.startsWith("Selected partners:") ||
    a.target.startsWith("Selected Sales Partners:")
  ) {
    const selected = a.target.replace(/^Selected (?:Sales Partners|partners):/, "").toLowerCase();
    return (
      selected.includes(partner.id.toLowerCase()) || selected.includes(partner.name.toLowerCase())
    );
  }
  return false;
}
