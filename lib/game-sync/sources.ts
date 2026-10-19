import * as cheerio from "cheerio";
import { assertAllowedSourceUrl } from "@/lib/game-extractor";
import { stageFromText } from "./plan";
import type { Observation, SyncLink, SyncSource } from "./types";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** No guessed dates: resolve a missing year only inside an explicit season. */
export function sourceDay(raw: string, source: SyncSource): string {
  const match = raw.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2})\b/i);
  if (!match) throw new Error("Official date format changed: " + raw);
  const month = months.indexOf(match[1].toLowerCase()) + 1;
  const day = Number(match[2]);
  const candidates = [source.year, source.year + 1].map(year => String(year) + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0"))
    .filter(date => date >= source.starts_on && date <= source.ends_on && new Date(date).toISOString().slice(0, 10) === date);
  if (candidates.length !== 1) throw new Error("Official date cannot be assigned to this competition: " + raw);
  const weekday = raw.match(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/i)?.[1];
  if (weekday && ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(candidates[0]).getUTCDay()] !== weekday.toLowerCase()) {
    throw new Error("Official weekday and date disagree: " + raw);
  }
  return candidates[0];
}

export function sourceTime(day: string, raw: string): string {
  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match || +match[1] < 1 || +match[1] > 12 || +match[2] > 59) throw new Error("Official start time is missing or invalid: " + raw);
  const hour = +match[1] % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return new Date(day + "T" + String(hour).padStart(2, "0") + ":" + match[2] + ":00+08:00").toISOString();
}

export async function fetchSource(url: string, init: RequestInit = {}): Promise<string> {
  let target = assertAllowedSourceUrl(url);
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(target, { ...init, cache: "no-store", redirect: "manual", signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000), headers: { "User-Agent": "Sportsmetric/1.0 (sportsmetric.ph)", ...init.headers } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Source redirect has no destination.");
      target = assertAllowedSourceUrl(new URL(location, target).toString());
      continue;
    }
    if (!response.ok) throw new Error("Official source returned HTTP " + response.status);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Official source returned an empty response.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > 4 * 1024 * 1024) throw new Error("Official source response exceeds the size limit.");
        chunks.push(part.value);
      }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("Too many official-source redirects.");
}

export interface BasketballRef { key: string; url: string; home: string; away: string; final: boolean; homeScore: number | null; awayScore: number | null }

export function parseBasketballIndex(html: string, url: string): BasketballRef[] {
  const $ = cheerio.load(html);
  const refs: BasketballRef[] = [];
  $("a.schedule-box[href]").each((_, el) => {
    const card = $(el);
    const link = new URL(card.attr("href")!, url);
    if (link.origin !== new URL(url).origin || link.pathname !== new URL(url).pathname) throw new Error("Unexpected tournament link in the official schedule.");
    const id = link.searchParams.get("game_id");
    if (!id || !/^\d+$/.test(id)) throw new Error("Official match ID is missing.");
    const sides = card.find(".scheduled-team");
    if (sides.length !== 2) throw new Error("Official match teams are missing.");
    const names = sides.map((_, side) => clean($(side).find(".team").text())).get();
    const scores = sides.map((_, side) => {
      const clone = $(side).clone(); clone.find(".team").remove();
      const text = clean(clone.text()); return /^\d+$/.test(text) ? +text : -1;
    }).get();
    refs.push({ key: "match:" + id, url: link.toString(), home: names[0], away: names[1], final: /^final$/i.test(clean(card.find(".schedule-details").text())), homeScore: scores[0] >= 0 ? scores[0] : null, awayScore: scores[1] >= 0 ? scores[1] : null });
  });
  if (!refs.length) throw new Error("No official match cards found. The source may have changed.");
  if (new Set(refs.map(r => r.key)).size !== refs.length) throw new Error("Official source contains duplicate match IDs.");
  return refs;
}

export function parseBasketballGame(html: string, ref: BasketballRef, source: SyncSource): Observation {
  const $ = cheerio.load(html);
  const details: Record<string, string> = {};
  $(".game-detail").each((_, el) => { details[clean($(el).find("h6").text()).toLowerCase()] = clean($(el).find("span").text()); });
  const slug = source.tournament_url.split("/").pop()!.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const competition = (details.competition ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (competition !== slug) throw new Error("Official result belongs to a different competition.");
  const date = details["game details"]?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)$/i);
  if (!date) throw new Error("Official match date is missing or changed format.");
  const year = date[3].length === 2 ? "20" + date[3] : date[3];
  const day = year + "-" + date[1].padStart(2, "0") + "-" + date[2].padStart(2, "0");
  if (new Date(day).toISOString().slice(0, 10) !== day) throw new Error("Invalid official match date.");
  // Confirm the fetched page still labels this exact ID final. The importer
  // accepts a caller-supplied status, so it cannot establish finality itself.
  const current = parseBasketballIndex(html, source.tournament_url).find(r => r.key === ref.key);
  if (!current || current.home !== ref.home || current.away !== ref.away || current.final !== ref.final) throw new Error("Official match changed during this check; retry next run.");
  const selectedHome = clean($("#scoreboard .team-0 .team_code").text());
  const selectedAway = clean($("#scoreboard .team-1 .team_code").text());
  const selectedScores = [clean($("#scoreboard .team-0 .team_score").text()), clean($("#scoreboard .team-1 .team_score").text())];
  if (selectedHome !== current.home || selectedAway !== current.away || (current.final &&
    (selectedScores.some(s => !/^\d+$/.test(s)) || +selectedScores[0] !== current.homeScore || +selectedScores[1] !== current.awayScore))) {
    throw new Error("Official page selected a different match or inconsistent scores.");
  }
  return { key: ref.key, home: ref.home, away: ref.away, day, startTime: sourceTime(day, date[4]), status: current.final ? "FINAL" : "UPCOMING", homeScore: current.homeScore, awayScore: current.awayScore, venue: details.venue || null, stage: "ELIMINATION", url: ref.url };
}

export function parsePbaSchedule(html: string, source: SyncSource): Observation[] {
  const $ = cheerio.load(html);
  if (!$(".schedule-day").length) throw new Error("PBA upcoming schedule is unavailable or changed format.");
  const items: Observation[] = [];
  let day: string | null = null;
  $(".schedule-day").each((_, el) => {
    const heading = clean($(el).find("h2").first().text());
    if (heading) day = sourceDay(heading, source);
    if (!day) throw new Error("PBA schedule has no date heading.");
    const matchDay = day;
    $(el).find(".schedule-teams").each((_, teams) => {
      const row = $(teams).parent();
      const names = $(teams).find(".schedule-team p").map((_, p) => clean($(p).text())).get();
      if (names.length !== 2) throw new Error("PBA schedule teams are missing.");
      const startTime = sourceTime(matchDay, clean(row.find(".schedule-time-venue p").first().text()));
      items.push({ key: "fixture:" + matchDay + ":" + names.join(":"), home: names[0], away: names[1], day: matchDay, startTime, status: "UPCOMING", homeScore: null, awayScore: null, venue: clean(row.find(".schedule-time-venue p").eq(1).text()) || null, stage: "ELIMINATION", url: "https://www.pba.ph/schedule" });
    });
  });
  return items;
}

export function parsePvlCards(html: string, source: SyncSource, final: boolean): Observation[] {
  const $ = cheerio.load(html);
  const items: Observation[] = [];
  if (!$(".match-date").length || !$(".match-card").length) throw new Error("PVL match cards are unavailable or changed format.");
  $(".match-card").each((_, el) => {
    const card = $(el);
    const heading = clean(card.parent().prevAll().find(".match-date").first().text());
    const day = sourceDay(heading.split("|")[0], source);
    const names = card.find(".match-card-teams h3").map((_, h) => clean($(h).text())).get();
    if (names.length !== 2) throw new Error("PVL match teams are missing.");
    if (names.some(n => /TBD|TBA/i.test(n))) return;
    const phase = clean(card.find(".match-card-footer").text());
    // Conditional playoff placeholders must not be announced as confirmed games.
    if (/if necessary/i.test(phase) && !final) return;
    const stage = stageFromText(phase);
    const scores = card.find(".match-card-score").map((_, s) => clean($(s).text())).get();
    if (final && (scores.length !== 2 || scores.some(s => !/^\d+$/.test(s)))) throw new Error("PVL final score is missing.");
    const pdf = card.find("a[href*='.pdf']").attr("href");
    if (final && !pdf) throw new Error("PVL result has no official match report.");
    const key = final ? "report:" + new URL(assertAllowedSourceUrl(pdf!)).pathname.split("/").pop()!.replace(/-P\d+\.pdf$/i, "") : "fixture:" + day + ":" + names.join(":") + ":" + stage;
    items.push({ key, home: names[0], away: names[1], day, startTime: final ? null : sourceTime(day, clean(card.find(".match-card-time").first().text())), status: final ? "FINAL" : "UPCOMING", homeScore: final ? +scores[0] : null, awayScore: final ? +scores[1] : null, venue: clean(heading.split("|").slice(1).join("|")) || null, stage, url: final ? pdf! : "https://pvl.ph/schedule" });
  });
  return items;
}

export async function collectObservations(source: SyncSource, links: SyncLink[], now: Date, signal?: AbortSignal): Promise<{ items: Observation[]; warnings: string[] }> {
  const read = (url: string, init: RequestInit = {}) => fetchSource(url, { ...init, signal });
  const warnings: string[] = [];
  if (source.league === "PVL") {
    const recap = await read("https://pvl.ph/recap");
    const $ = cheerio.load(recap);
    const selected = $("#conferenceFilter option:selected").attr("value");
    if (selected !== source.conference_id) throw new Error("PVL has switched conferences. Configure the new competition before continuing.");
    const items = parsePvlCards(recap, source, true);
    try {
      const schedule = await read("https://pvl.ph/initialize-schedule", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "isViewAll=1" });
      items.push(...parsePvlCards(schedule, source, false));
    } catch (error) { warnings.push("PVL schedule: " + (error instanceof Error ? error.message : String(error))); }
    return { items, warnings };
  }
  const html = await read(source.tournament_url);
  const refs = parseBasketballIndex(html, source.tournament_url);
  // Only inspect the latest results; historical backfill remains an explicit
  // import. Existing links get rechecked for corrections for three days.
  const eligible = refs.slice(0, 8).filter(ref => {
    const link = links.find(l => l.source_id === source.id && l.source_key === ref.key);
    return !link || !ref.final || Date.parse(link.snapshot?.start_time ?? "") > now.getTime() - 3 * 86400000;
  }).sort((a, b) => {
    const la = links.find(l => l.source_id === source.id && l.source_key === a.key);
    const lb = links.find(l => l.source_id === source.id && l.source_key === b.key);
    return (la ? 1 : 0) - (lb ? 1 : 0) || Date.parse(la?.last_checked_at ?? "1970-01-01") - Date.parse(lb?.last_checked_at ?? "1970-01-01");
  });
  const observations: Observation[] = [];
  for (const ref of eligible.slice(0, 4)) {
    try {
      const gameHtml = ref.url === source.tournament_url ? html : await read(ref.url);
      observations.push(parseBasketballGame(gameHtml, ref, source));
    } catch (error) { warnings.push(ref.key + ": " + (error instanceof Error ? error.message : String(error))); }
  }
  if (source.league === "PBA") {
    try { observations.push(...parsePbaSchedule(await read("https://www.pba.ph/schedule"), source)); }
    catch (error) { warnings.push("PBA schedule: " + (error instanceof Error ? error.message : String(error))); }
  }
  return { items: observations, warnings };
}
