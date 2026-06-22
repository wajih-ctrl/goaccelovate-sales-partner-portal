import type { Announcement, Partner } from "./mock-data";

export const REGION_COUNTRIES: Record<string, string[]> = {
  "APAC region": ["India", "Japan", "Vietnam", "China", "South Korea", "UAE"],
  "EMEA region": ["Nigeria", "Italy", "United Kingdom", "Germany", "Portugal", "Norway", "Spain", "Israel", "France", "Sweden", "Turkey", "Egypt", "Denmark", "UAE"],
  "Americas region": ["USA", "Brazil", "Mexico", "Chile"],
};

export function isAnnouncementTargeted(a: Announcement, partner?: Partner) {
  if (!partner) return false;
  if (a.target === "All partners") return true;
  if (a.target === `${partner.tier} tier`) return true;
  if (REGION_COUNTRIES[a.target]?.includes(partner.country)) return true;
  if (a.target.startsWith("Selected partners:")) {
    const selected = a.target.replace("Selected partners:", "").toLowerCase();
    return selected.includes(partner.id.toLowerCase()) || selected.includes(partner.name.toLowerCase());
  }
  return false;
}
