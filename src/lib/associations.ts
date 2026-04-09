import schedule from "@/data/schedule.json";
import { Team, Schedule } from "./types";

const data = schedule as Schedule;

export interface Association {
  name: string; // org name as it appears in team names
  teams: Team[]; // all teams across levels sharing this name
}

// Multi-word locations that need explicit splitting
const MULTI_WORD_LOCATIONS: Record<string, [string, string]> = {
  "North Halton Twisters": ["North Halton", "Twisters"],
  "North Bay Junior Lakers": ["North Bay", "Junior Lakers"],
  "North Durham Blades": ["North Durham", "Blades"],
  "North Simcoe Capitals": ["North Simcoe", "Capitals"],
  "North York Storm": ["North York", "Storm"],
  "South Bruce Blades": ["South Bruce", "Blades"],
  "South Huron Sabres": ["South Huron", "Sabres"],
  "East Ottawa Stars": ["East Ottawa", "Stars"],
  "West Northumberland Wild": ["West Northumberland", "Wild"],
  "West Oxford Inferno": ["West Oxford", "Inferno"],
  "Carleton Place Cyclones": ["Carleton Place", "Cyclones"],
  "Central Perth Predators": ["Central Perth", "Predators"],
  "Central York Panthers": ["Central York", "Panthers"],
  "Durham West Lightning": ["Durham West", "Lightning"],
  "Chatham Kent Crush": ["Chatham Kent", "Crush"],
  "Cold Creek Comets": ["Cold Creek", "Comets"],
  "Cornwall Lady Royals": ["Cornwall", "Lady Royals"],
  "Fort Frances Leafs": ["Fort Frances", "Leafs"],
  "Grand River Mustangs": ["Grand River", "Mustangs"],
  "Guelph Jr Gryphons": ["Guelph", "Jr Gryphons"],
  "Kapuskasing James Bay Northern Hawks": ["Kapuskasing", "James Bay Northern Hawks"],
  "Markham-Stouffville Stars": ["Markham-Stouffville", "Stars"],
  "Mount Forest Rams": ["Mount Forest", "Rams"],
  "Owen Sound Ice Hawks": ["Owen Sound", "Ice Hawks"],
  "Ottawa Valley Thunder": ["Ottawa Valley", "Thunder"],
  "Sault Ste. Marie": ["Sault Ste. Marie", ""],
  "St Thomas Panthers": ["St Thomas", "Panthers"],
  "St. Catharines Brock Jr. Badgers": ["St. Catharines", "Brock Jr. Badgers"],
  "St.Marys Rock": ["St.Marys", "Rock"],
  "Stoney Creek Sabres": ["Stoney Creek", "Sabres"],
  "Temiskaming Shores Puckhounds": ["Temiskaming Shores", "Puckhounds"],
  "Thunder Bay Queens": ["Thunder Bay", "Queens"],
  "Toronto Leaside Wildcats": ["Toronto Leaside", "Wildcats"],
  "Twin Centre Hericanes": ["Twin Centre", "Hericanes"],
  "Upper Maitland Mustangs": ["Upper Maitland", "Mustangs"],
  "Saugeen Shores Storm": ["Saugeen Shores", "Storm"],
  "Saugeen-Maitland Lightning": ["Saugeen-Maitland", "Lightning"],
  "Markdale": ["Markdale", ""],
  "Parkhill": ["Parkhill", ""],
  "Nipigon Elks": ["Nipigon", "Elks"],
  "Manitoulin Lady Panthers": ["Manitoulin", "Lady Panthers"],
  "Kapuskasing Jaguars": ["Kapuskasing", "Jaguars"],
  "Haldimand Rivercats": ["Haldimand", "Rivercats"],
  "Wingham 86ers": ["Wingham", "86ers"],
};

export function splitAssociation(name: string): { location: string; teamName: string } {
  const override = MULTI_WORD_LOCATIONS[name];
  if (override) {
    return { location: override[0], teamName: override[1] };
  }
  // Default: first word is location, rest is team name
  const spaceIdx = name.indexOf(" ");
  if (spaceIdx === -1) {
    return { location: name, teamName: "" };
  }
  return { location: name.substring(0, spaceIdx), teamName: name.substring(spaceIdx + 1) };
}

// All teams flattened
const allTeams: Team[] = data.levels.flatMap((level) => level.teams as Team[]);

// Build association map (keyed by org name)
function buildAssociations(): Association[] {
  const map: Record<string, Team[]> = {};
  for (const team of allTeams) {
    if (!map[team.name]) map[team.name] = [];
    map[team.name].push(team);
  }
  return Object.entries(map)
    .map(([name, teams]) => ({ name, teams }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

let _associations: Association[] | null = null;

export function getAssociations(): Association[] {
  if (!_associations) {
    _associations = buildAssociations();
  }
  return _associations;
}

export function getAssociationsByLetter(): Record<string, Association[]> {
  const assocs = getAssociations();
  const grouped: Record<string, Association[]> = {};
  for (const a of assocs) {
    const letter = a.name[0].toUpperCase();
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(a);
  }
  return grouped;
}
