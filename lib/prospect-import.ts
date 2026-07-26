// ──────────────────────────────────────────────────────────────────
// lib/prospect-import.ts
// CSV import for creator prospects. Pure — no I/O — so the awkward shapes
// real exports produce (quoted commas, BOMs, CRLF, blank trailing lines,
// "1,200" follower counts) are all testable.
//
// Import never partially applies a bad file silently: every row is either
// accepted or reported with its line number and reason.
// ──────────────────────────────────────────────────────────────────

import { validateProspect, type ProspectFields } from "@/lib/prospects";

/** Header aliases, so an export from a spreadsheet usually just works. */
const HEADER_ALIASES: Record<string, keyof ProspectFields | "ignore"> = {
  name: "display_name",
  "display name": "display_name",
  "full name": "display_name",
  creator: "display_name",
  display_name: "display_name",

  platform: "platform",
  network: "platform",

  handle: "platform_handle",
  username: "platform_handle",
  "platform handle": "platform_handle",
  platform_handle: "platform_handle",

  url: "profile_url",
  link: "profile_url",
  "profile url": "profile_url",
  profile_url: "profile_url",

  email: "email",
  "email address": "email",
  "business email": "email",

  niche: "niche",
  category: "niche",

  followers: "follower_count",
  "follower count": "follower_count",
  follower_count: "follower_count",
  subscribers: "follower_count",

  location: "location",
  country: "location",
  city: "location",

  source: "source",
  "lead source": "source",

  "source detail": "source_detail",
  source_detail: "source_detail",

  score: "score",
  rating: "score",

  notes: "notes",
  note: "notes",
  comment: "notes",

  "follow up": "follow_up_at",
  "follow-up": "follow_up_at",
  "follow up date": "follow_up_at",
  follow_up_at: "follow_up_at",

  "handle wanted": "handle_wanted",
  handle_wanted: "handle_wanted",
  "spotlightly handle": "handle_wanted",
};

/**
 * Split one CSV line, honouring double quotes and "" escapes.
 * Written out rather than pulled from a dependency because the format is
 * small, the behaviour needs to be exactly specified, and this is the code
 * path where a subtle parsing bug would silently corrupt somebody's data.
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

export interface ImportRowError {
  line: number;
  errors: string[];
}

export interface ImportResult {
  rows: ProspectFields[];
  errors: ImportRowError[];
  /** Header names present in the file that we did not recognise. */
  unknownHeaders: string[];
  totalDataLines: number;
}

export const MAX_IMPORT_ROWS = 1000;

/**
 * Parse a CSV into validated prospect rows.
 *
 * `defaultSource` applies to any row whose source column is blank, so an
 * import from a conference list can be attributed without editing the file.
 */
export function parseProspectCsv(text: string, defaultSource = "csv"): ImportResult {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = clean.split("\n");

  // Skip leading blank lines before the header.
  let headerIdx = 0;
  while (headerIdx < lines.length && lines[headerIdx].trim() === "") headerIdx++;
  if (headerIdx >= lines.length) {
    return { rows: [], errors: [{ line: 1, errors: ["The file is empty."] }], unknownHeaders: [], totalDataLines: 0 };
  }

  const rawHeaders = parseCsvLine(lines[headerIdx]).map((h) => h.toLowerCase());
  const unknownHeaders: string[] = [];
  const mapped = rawHeaders.map((h) => {
    const key = HEADER_ALIASES[h];
    if (!key) { if (h) unknownHeaders.push(h); return null; }
    return key === "ignore" ? null : key;
  });

  if (!mapped.includes("display_name")) {
    return {
      rows: [],
      errors: [{ line: headerIdx + 1, errors: ["No name column found. Add a column called 'name'."] }],
      unknownHeaders,
      totalDataLines: 0,
    };
  }

  const rows: ProspectFields[] = [];
  const errors: ImportRowError[] = [];
  let totalDataLines = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;          // blank/trailing lines are not errors
    totalDataLines++;

    if (totalDataLines > MAX_IMPORT_ROWS) {
      errors.push({ line: i + 1, errors: [`Import is limited to ${MAX_IMPORT_ROWS} rows per file.`] });
      break;
    }

    const cells = parseCsvLine(line);
    const input: Record<string, unknown> = {};
    mapped.forEach((key, idx) => {
      if (!key) return;
      const v = cells[idx];
      if (v !== undefined && v !== "") input[key] = v;
    });
    if (!input.source) input.source = defaultSource;

    const result = validateProspect(input);
    if (result.ok) rows.push(result.value);
    else errors.push({ line: i + 1, errors: result.errors });
  }

  return { rows, errors, unknownHeaders, totalDataLines };
}

/**
 * Drop rows that collide with each other inside a single file, keeping the
 * first. The database has unique indexes on email and (platform, handle),
 * but a duplicate within one upload would otherwise abort the whole insert.
 */
export function dedupeImportRows(rows: ProspectFields[]): { kept: ProspectFields[]; duplicates: number } {
  const seenEmail = new Set<string>();
  const seenPlatform = new Set<string>();
  const kept: ProspectFields[] = [];
  let duplicates = 0;

  for (const r of rows) {
    const emailKey = r.email ? `e:${r.email.toLowerCase()}` : null;
    const platformKey = r.platform && r.platform_handle
      ? `p:${r.platform}:${r.platform_handle.toLowerCase()}`
      : null;

    if ((emailKey && seenEmail.has(emailKey)) || (platformKey && seenPlatform.has(platformKey))) {
      duplicates++;
      continue;
    }
    if (emailKey) seenEmail.add(emailKey);
    if (platformKey) seenPlatform.add(platformKey);
    kept.push(r);
  }

  return { kept, duplicates };
}
