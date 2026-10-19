"use client";

import type { ToastFn } from "@/components/admin/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/FilterChip";
import { Notice } from "@/components/ui/Notice";
import { Badge } from "@/components/ui/Badge";
import { adminMutate, type AdminMutation } from "@/lib/admin-api";
import {
  COMPETITION_LEVELS, CONNECTION_LABELS, FILIPINO_CONNECTIONS, INTERNATIONAL_LAUNCHED, LEVEL_LABELS, MEDALS,
  REPRESENTATIONS, REPRESENTATION_LABELS, RESULT_TYPES, RESULT_TYPE_LABELS, athletePath, formatResultHeadline,
  parseStats, slugify, type InternationalData, type IntlAthlete, type IntlCompetition, type IntlResult, type StatLine,
} from "@/lib/international";
import { cn } from "@/lib/utils";
import { ExternalLink, Loader2, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { dangerButtonClass, ghostButtonClass, primaryButtonClass, SectionCard } from "./formPrimitives";

type Section = "athletes" | "competitions" | "results";
const SECTIONS = [
  { value: "athletes", label: "Athletes" },
  { value: "competitions", label: "Competitions" },
  { value: "results", label: "Results" },
] as const;

const EMPTY: InternationalData = { athletes: [], competitions: [], results: [], available: true };

// ---------------------------------------------------------------------------
// Form state (everything as strings so inputs stay controlled)

type AthleteForm = { isNew: boolean; id: string; name: string; sports: string; filipinoConnection: string; connectionSourceUrl: string;
  connectionNote: string; personId: string; photoUrl: string; photoCredit: string; photoLicense: string; photoSourceUrl: string;
  bio: string; coverageNote: string; reviewedAt: string; published: boolean };
type CompetitionForm = { isNew: boolean; id: string; name: string; sport: string; level: string; hostCountry: string; season: string;
  startDate: string; endDate: string; sourceUrl: string };
type ResultForm = { isNew: boolean; id: string; athleteId: string; competitionId: string; event: string; representation: string;
  represented: string; resultType: string; placement: string; fieldSize: string; medal: string; markValue: string; markUnit: string;
  stats: string; scope: string; resultDate: string; sourceUrl: string; sourcePublisher: string; reviewedAt: string; notes: string; published: boolean };

const blankAthlete = (): AthleteForm => ({ isNew: true, id: "", name: "", sports: "", filipinoConnection: "citizen", connectionSourceUrl: "",
  connectionNote: "", personId: "", photoUrl: "", photoCredit: "", photoLicense: "", photoSourceUrl: "", bio: "",
  coverageNote: "", reviewedAt: "", published: false });
const athleteForm = (a: IntlAthlete): AthleteForm => ({ isNew: false, id: a.id, name: a.name, sports: a.sports.join(", "),
  filipinoConnection: a.filipinoConnection, connectionSourceUrl: a.connectionSourceUrl, connectionNote: a.connectionNote ?? "",
  personId: a.personId ?? "", photoUrl: a.photoUrl ?? "", photoCredit: a.photoCredit ?? "", photoLicense: a.photoLicense ?? "",
  photoSourceUrl: a.photoSourceUrl ?? "", bio: a.bio ?? "", coverageNote: a.coverageNote ?? "",
  reviewedAt: a.reviewedAt ?? "", published: a.published });

const blankCompetition = (): CompetitionForm => ({ isNew: true, id: "", name: "", sport: "", level: "world_championship",
  hostCountry: "", season: "", startDate: "", endDate: "", sourceUrl: "" });
const competitionForm = (c: IntlCompetition): CompetitionForm => ({ isNew: false, id: c.id, name: c.name, sport: c.sport, level: c.level,
  hostCountry: c.hostCountry ?? "", season: c.season ?? "", startDate: c.startDate ?? "", endDate: c.endDate ?? "", sourceUrl: c.sourceUrl ?? "" });

const blankResult = (athleteId = "", competitionId = ""): ResultForm => ({ isNew: true, id: "", athleteId, competitionId, event: "",
  representation: "national_team", represented: "Philippines", resultType: "placement", placement: "", fieldSize: "", medal: "",
  markValue: "", markUnit: "", stats: "", scope: "", resultDate: "", sourceUrl: "", sourcePublisher: "", reviewedAt: "", notes: "", published: false });
const resultForm = (r: IntlResult): ResultForm => ({ isNew: false, id: r.id, athleteId: r.athleteId, competitionId: r.competitionId,
  event: r.event, representation: r.representation, represented: r.represented, resultType: r.resultType,
  placement: r.placement?.toString() ?? "", fieldSize: r.fieldSize?.toString() ?? "", medal: r.medal ?? "",
  markValue: r.markValue?.toString() ?? "", markUnit: r.markUnit ?? "",
  stats: r.stats ? Object.entries(r.stats).map(([k, v]) => `${k}=${v}`).join(", ") : "", scope: r.scope ?? "",
  resultDate: r.resultDate ?? "", sourceUrl: r.sourceUrl, sourcePublisher: r.sourcePublisher ?? "", reviewedAt: r.reviewedAt ?? "",
  notes: r.notes ?? "", published: r.published });

const blankToNull = (v: string) => (v.trim() ? v.trim() : null);
const numOrNull = (v: string) => (v.trim() ? Number(v) : null);

async function fetchInternational(): Promise<{ data: InternationalData } | { error: string }> {
  try {
    const response = await fetch("/api/admin/international", { credentials: "same-origin", cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { error: body?.error ?? `Request failed with status ${response.status}.` };
    return { data: body as InternationalData };
  } catch {
    return { error: "Network error — check your connection and retry." };
  }
}

// ---------------------------------------------------------------------------

function Row({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Checkbox({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return <label className="flex min-h-11 items-start gap-3 rounded-control border border-border bg-surface-2 px-3 py-2.5">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
    <span><span className="block text-xs font-semibold text-foreground">{label}</span><span className="block text-2xs text-muted">{hint}</span></span>
  </label>;
}

function ListButton({ selected, onClick, title, meta, published }: { selected: boolean; onClick: () => void; title: string; meta: string; published?: boolean }) {
  return <button type="button" onClick={onClick} aria-pressed={selected}
    className={cn("flex w-full min-h-12 items-center justify-between gap-2 rounded-control border px-3 py-2 text-left transition-colors",
      selected ? "border-primary/50 bg-primary/10" : "border-border bg-surface-2 hover:border-primary/30")}>
    <span className="min-w-0"><span className="block truncate text-xs font-semibold text-foreground">{title}</span>
      <span className="block truncate text-2xs text-muted">{meta}</span></span>
    {published !== undefined && <Badge tone={published ? "success" : "outline"}>{published ? "Published" : "Draft"}</Badge>}
  </button>;
}

export function InternationalManager({ onToast }: { onToast: ToastFn }) {
  const confirm = useConfirm();
  const [data, setData] = useState<InternationalData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<Section>("athletes");
  const [athlete, setAthlete] = useState<AthleteForm>(blankAthlete);
  const [competition, setCompetition] = useState<CompetitionForm>(blankCompetition);
  const [result, setResult] = useState<ResultForm>(() => blankResult());
  const [resultFilter, setResultFilter] = useState("");

  const apply = useCallback((outcome: { data: InternationalData } | { error: string }) => {
    if ("data" in outcome) { setData(outcome.data); setLoadError(null); }
    else setLoadError(outcome.error);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    apply(await fetchInternational());
  }, [apply]);

  useEffect(() => {
    let active = true;
    void fetchInternational().then(outcome => { if (active) apply(outcome); });
    return () => { active = false; };
  }, [apply]);

  const athletesById = useMemo(() => new Map(data.athletes.map(a => [a.id, a])), [data.athletes]);
  const competitionsById = useMemo(() => new Map(data.competitions.map(c => [c.id, c])), [data.competitions]);

  async function run(mutation: AdminMutation, success: string): Promise<boolean> {
    setSaving(true);
    try {
      await adminMutate(mutation);
      onToast(success);
      await load();
      return true;
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Save failed.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // -- Athletes -------------------------------------------------------------
  async function saveAthlete(event: FormEvent) {
    event.preventDefault();
    const id = athlete.isNew ? (athlete.id.trim() || slugify(athlete.name)) : athlete.id;
    if (athlete.isNew && athletesById.has(id)) { onToast(`An athlete with the slug "${id}" already exists.`, "error"); return; }
    const payload: IntlAthlete = { id, name: athlete.name, sports: athlete.sports.split(",").map(s => s.trim()).filter(Boolean),
      filipinoConnection: athlete.filipinoConnection as IntlAthlete["filipinoConnection"], connectionSourceUrl: athlete.connectionSourceUrl,
      connectionNote: blankToNull(athlete.connectionNote), personId: blankToNull(athlete.personId), photoUrl: blankToNull(athlete.photoUrl),
      photoCredit: blankToNull(athlete.photoCredit), photoLicense: blankToNull(athlete.photoLicense), photoSourceUrl: blankToNull(athlete.photoSourceUrl),
      bio: blankToNull(athlete.bio), coverageNote: blankToNull(athlete.coverageNote), reviewedAt: blankToNull(athlete.reviewedAt), published: athlete.published };
    if (await run({ op: "intl.athlete.upsert", athlete: payload }, `Saved ${payload.name}.`)) setAthlete({ ...athlete, isNew: false, id });
  }

  async function removeAthlete() {
    const count = data.results.filter(r => r.athleteId === athlete.id).length;
    if (!(await confirm({ title: `Delete ${athlete.name}?`, tone: "danger", confirmLabel: "Delete athlete",
      description: count ? `This also deletes ${count} result${count === 1 ? "" : "s"} recorded for this athlete.` : "This cannot be undone." }))) return;
    if (await run({ op: "intl.athlete.delete", id: athlete.id }, "Athlete deleted.")) setAthlete(blankAthlete());
  }

  // -- Competitions ---------------------------------------------------------
  async function saveCompetition(event: FormEvent) {
    event.preventDefault();
    const id = competition.isNew ? (competition.id.trim() || slugify(`${competition.name} ${competition.season}`)) : competition.id;
    if (competition.isNew && competitionsById.has(id)) { onToast(`A competition with the ID "${id}" already exists.`, "error"); return; }
    const payload: IntlCompetition = { id, name: competition.name, sport: competition.sport, level: competition.level as IntlCompetition["level"],
      hostCountry: blankToNull(competition.hostCountry), season: blankToNull(competition.season), startDate: blankToNull(competition.startDate),
      endDate: blankToNull(competition.endDate), sourceUrl: blankToNull(competition.sourceUrl) };
    if (await run({ op: "intl.competition.upsert", competition: payload }, `Saved ${payload.name}.`)) setCompetition({ ...competition, isNew: false, id });
  }

  async function removeCompetition() {
    if (!(await confirm({ title: `Delete ${competition.name}?`, tone: "danger", confirmLabel: "Delete competition",
      description: "Competitions that still have results cannot be deleted." }))) return;
    if (await run({ op: "intl.competition.delete", id: competition.id }, "Competition deleted.")) setCompetition(blankCompetition());
  }

  // -- Results --------------------------------------------------------------
  async function saveResult(event: FormEvent) {
    event.preventDefault();
    let stats: StatLine | null;
    try { stats = parseStats(result.stats); } catch (err) { onToast((err as Error).message, "error"); return; }
    const id = result.isNew ? crypto.randomUUID() : result.id;
    const payload: IntlResult = { id, athleteId: result.athleteId, competitionId: result.competitionId, event: result.event,
      representation: result.representation as IntlResult["representation"], represented: result.represented,
      resultType: result.resultType as IntlResult["resultType"], placement: numOrNull(result.placement), fieldSize: numOrNull(result.fieldSize),
      medal: (result.medal || null) as IntlResult["medal"], markValue: numOrNull(result.markValue), markUnit: blankToNull(result.markUnit),
      stats, scope: blankToNull(result.scope), resultDate: blankToNull(result.resultDate), sourceUrl: result.sourceUrl,
      sourcePublisher: blankToNull(result.sourcePublisher), reviewedAt: blankToNull(result.reviewedAt), notes: blankToNull(result.notes),
      published: result.published };
    if (await run({ op: "intl.result.upsert", result: payload }, "Result saved.")) {
      // Keep athlete/competition/source for fast entry of the next event.
      setResult(result.isNew ? { ...blankResult(result.athleteId, result.competitionId), representation: result.representation,
        represented: result.represented, sourceUrl: result.sourceUrl, sourcePublisher: result.sourcePublisher, reviewedAt: result.reviewedAt } : { ...result, id });
    }
  }

  async function removeResult() {
    if (!(await confirm({ title: "Delete this result?", tone: "danger", confirmLabel: "Delete result" }))) return;
    if (await run({ op: "intl.result.delete", id: result.id }, "Result deleted.")) setResult(blankResult(result.athleteId, result.competitionId));
  }

  const filteredResults = data.results.filter(r => !resultFilter || r.athleteId === resultFilter);
  const set = <T,>(setter: (fn: (prev: T) => T) => void) => (key: keyof T) => (e: { target: { value: string } }) =>
    setter(prev => ({ ...prev, [key]: e.target.value }));
  const onAthlete = set<AthleteForm>(setAthlete);
  const onCompetition = set<CompetitionForm>(setCompetition);
  const onResult = set<ResultForm>(setResult);

  const needsPlacement = result.resultType === "placement" || result.resultType === "ranking";
  const hasPhoto = Boolean(athlete.photoUrl.trim());

  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SegmentedControl options={SECTIONS} value={section} onChange={setSection} className="max-w-md flex-1" />
      <div className="flex items-center gap-2">
        <a href="/international" target="_blank" rel="noopener noreferrer" className={ghostButtonClass}>Preview hub <ExternalLink size={12} aria-hidden="true" /></a>
        <button type="button" className={ghostButtonClass} onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={12} aria-hidden="true" />} Reload
        </button>
      </div>
    </div>

    {!INTERNATIONAL_LAUNCHED && <Notice tone="info" className="px-4 py-2.5 text-xs">
      The International section is in preview: it is hidden from navigation, the sitemap and search engines. Set <code>INTERNATIONAL_LAUNCHED</code> in <code>lib/international.ts</code> to launch it once profiles are verified.
    </Notice>}
    {loadError && <Notice tone="error" className="px-4 py-2.5 text-xs">{loadError}</Notice>}
    {!loading && !loadError && !data.available && <Notice tone="warning" className="px-4 py-2.5 text-xs">
      The international tables are missing. Apply <code>supabase/migrations/20261020000000_international.sql</code> to the database first.
    </Notice>}

    {section === "athletes" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <SectionCard title={`Athletes (${data.athletes.length})`} action={<button type="button" className={ghostButtonClass} onClick={() => setAthlete(blankAthlete())}><Plus size={12} aria-hidden="true" /> New</button>}>
        <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
          {data.athletes.map(a => <ListButton key={a.id} selected={!athlete.isNew && athlete.id === a.id} onClick={() => setAthlete(athleteForm(a))}
            title={a.name} meta={`${a.sports.join(", ") || "No sport"} · ${data.results.filter(r => r.athleteId === a.id).length} results`} published={a.published} />)}
          {!data.athletes.length && <p className="text-xs text-muted">No athletes yet.</p>}
        </div>
      </SectionCard>
      <SectionCard title={athlete.isNew ? "New athlete" : `Edit ${athlete.name}`}>
        <form onSubmit={saveAthlete} className="flex flex-col gap-3">
          <Row>
            <Field label="Name"><Input required value={athlete.name} onChange={onAthlete("name")} placeholder="Full public name" /></Field>
            <Field label="URL slug" hint={athlete.isNew ? `Leave blank to use “${slugify(athlete.name) || "…"}”.` : "Slugs cannot change after creation."}>
              <Input value={athlete.isNew ? athlete.id : athlete.id} disabled={!athlete.isNew} onChange={onAthlete("id")} placeholder={slugify(athlete.name)} /></Field>
          </Row>
          <Row>
            <Field label="Sports" hint="Comma separated, e.g. Athletics"><Input value={athlete.sports} onChange={onAthlete("sports")} /></Field>
            <Field label="Filipino connection"><Select value={athlete.filipinoConnection} onChange={onAthlete("filipinoConnection")}>
              {FILIPINO_CONNECTIONS.map(c => <option key={c} value={c}>{CONNECTION_LABELS[c]}</option>)}</Select></Field>
          </Row>
          <Field label="Connection source (required)" hint="Public https link that supports the Filipino connection. Do not infer it from a name or club.">
            <Input required type="url" value={athlete.connectionSourceUrl} onChange={onAthlete("connectionSourceUrl")} placeholder="https://" /></Field>
          <Field label="Connection note" hint="e.g. Born in Manila; represents the Philippines since 2014."><Input value={athlete.connectionNote} onChange={onAthlete("connectionNote")} /></Field>
          <Field label="Short bio"><Textarea value={athlete.bio} onChange={onAthlete("bio")} className="min-h-20" /></Field>
          <Field label="Coverage note" hint="What this profile does not include yet."><Input value={athlete.coverageNote} onChange={onAthlete("coverageNote")} /></Field>
          <Row>
            <Field label="League person ID (optional)" hint="players.person_id to link their PBA/UAAP/PVL profile."><Input value={athlete.personId} onChange={onAthlete("personId")} /></Field>
            <Field label="Profile reviewed"><Input type="date" value={athlete.reviewedAt} onChange={onAthlete("reviewedAt")} /></Field>
          </Row>
          <Field label="Photo URL (optional)" hint="Approved image host only. A photo is saved only with a credit, license and source link.">
            <Input value={athlete.photoUrl} onChange={onAthlete("photoUrl")} /></Field>
          <Row>
            <Field label="Photo credit" hint="Photographer or rights holder.">
              <Input required={hasPhoto} value={athlete.photoCredit} onChange={onAthlete("photoCredit")}
                placeholder="Jane Doe / Wikimedia Commons" /></Field>
            <Field label="Photo license" hint="e.g. CC BY-SA 4.0, public domain, editorial use by permission.">
              <Input required={hasPhoto} value={athlete.photoLicense} onChange={onAthlete("photoLicense")}
                placeholder="CC BY-SA 4.0" /></Field>
          </Row>
          <Field label="Photo source / license link" hint="Public page where the image and its license or permission are recorded.">
            <Input required={hasPhoto} type="url" value={athlete.photoSourceUrl} onChange={onAthlete("photoSourceUrl")} placeholder="https://" /></Field>
          <Checkbox checked={athlete.published} onChange={v => setAthlete(p => ({ ...p, published: v }))} label="Published" hint="Only published athletes are visible on the site." />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? "Saving…" : "Save athlete"}</button>
            {!athlete.isNew && <>
              <button type="button" className={ghostButtonClass} onClick={() => { setResult(blankResult(athlete.id)); setResultFilter(athlete.id); setSection("results"); }}>Add result</button>
              <a className={ghostButtonClass} href={athletePath(athlete.id)} target="_blank" rel="noopener noreferrer">View</a>
              <button type="button" disabled={saving} className={cn(dangerButtonClass, "ml-auto")} onClick={() => void removeAthlete()}>Delete</button>
            </>}
          </div>
        </form>
      </SectionCard>
    </div>}

    {section === "competitions" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <SectionCard title={`Competitions (${data.competitions.length})`} action={<button type="button" className={ghostButtonClass} onClick={() => setCompetition(blankCompetition())}><Plus size={12} aria-hidden="true" /> New</button>}>
        <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
          {data.competitions.map(c => <ListButton key={c.id} selected={!competition.isNew && competition.id === c.id} onClick={() => setCompetition(competitionForm(c))}
            title={`${c.name}${c.season ? ` (${c.season})` : ""}`} meta={`${c.sport} · ${LEVEL_LABELS[c.level]}`} />)}
          {!data.competitions.length && <p className="text-xs text-muted">No competitions yet.</p>}
        </div>
      </SectionCard>
      <SectionCard title={competition.isNew ? "New competition" : `Edit ${competition.name}`}>
        <form onSubmit={saveCompetition} className="flex flex-col gap-3">
          <Field label="Name" hint="e.g. World Athletics Championships, Japan B.League"><Input required value={competition.name} onChange={onCompetition("name")} /></Field>
          <Row>
            <Field label="Sport"><Input required value={competition.sport} onChange={onCompetition("sport")} list="intl-sports" /></Field>
            <Field label="Level"><Select value={competition.level} onChange={onCompetition("level")}>
              {COMPETITION_LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}</Select></Field>
          </Row>
          <Row>
            <Field label="Season / edition" hint="e.g. 2025 or 2025-26"><Input value={competition.season} onChange={onCompetition("season")} /></Field>
            <Field label="Host country"><Input value={competition.hostCountry} onChange={onCompetition("hostCountry")} /></Field>
          </Row>
          <Row>
            <Field label="Start date"><Input type="date" value={competition.startDate} onChange={onCompetition("startDate")} /></Field>
            <Field label="End date"><Input type="date" value={competition.endDate} onChange={onCompetition("endDate")} /></Field>
          </Row>
          <Field label="ID" hint={competition.isNew ? `Leave blank to use “${slugify(`${competition.name} ${competition.season}`) || "…"}”.` : "IDs cannot change after creation."}>
            <Input value={competition.id} disabled={!competition.isNew} onChange={onCompetition("id")} /></Field>
          <Field label="Official page (optional)"><Input type="url" value={competition.sourceUrl} onChange={onCompetition("sourceUrl")} placeholder="https://" /></Field>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? "Saving…" : "Save competition"}</button>
            {!competition.isNew && <button type="button" disabled={saving} className={cn(dangerButtonClass, "ml-auto")} onClick={() => void removeCompetition()}>Delete</button>}
          </div>
        </form>
      </SectionCard>
    </div>}

    {section === "results" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <SectionCard title={`Results (${filteredResults.length})`} action={<button type="button" className={ghostButtonClass} onClick={() => setResult(blankResult(resultFilter))}><Plus size={12} aria-hidden="true" /> New</button>}>
        <Select value={resultFilter} onChange={e => setResultFilter(e.target.value)} aria-label="Filter by athlete">
          <option value="">All athletes</option>
          {data.athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
          {filteredResults.map(r => <ListButton key={r.id} selected={!result.isNew && result.id === r.id} onClick={() => setResult(resultForm(r))}
            title={`${athletesById.get(r.athleteId)?.name ?? r.athleteId} — ${r.event}`}
            meta={`${competitionsById.get(r.competitionId)?.name ?? r.competitionId} · ${formatResultHeadline(r)}`} published={r.published} />)}
          {!filteredResults.length && <p className="text-xs text-muted">No results yet.</p>}
        </div>
      </SectionCard>
      <SectionCard title={result.isNew ? "New result" : "Edit result"}>
        {!data.athletes.length || !data.competitions.length ? <p className="text-xs text-muted">Add at least one athlete and one competition first.</p> :
        <form onSubmit={saveResult} className="flex flex-col gap-3">
          <Row>
            <Field label="Athlete"><Select required value={result.athleteId} onChange={onResult("athleteId")}>
              <option value="">Choose…</option>{data.athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
            <Field label="Competition"><Select required value={result.competitionId} onChange={onResult("competitionId")}>
              <option value="">Choose…</option>{data.competitions.map(c => <option key={c.id} value={c.id}>{c.name}{c.season ? ` (${c.season})` : ""}</option>)}</Select></Field>
          </Row>
          <Row>
            <Field label="Event" hint="e.g. Men's pole vault, Regular season, Women's singles"><Input required value={result.event} onChange={onResult("event")} /></Field>
            <Field label="Scope" hint="e.g. Final, Season average, WTA singles ranking"><Input value={result.scope} onChange={onResult("scope")} /></Field>
          </Row>
          <Row>
            <Field label="Representation"><Select value={result.representation} onChange={onResult("representation")}>
              {REPRESENTATIONS.map(r => <option key={r} value={r}>{REPRESENTATION_LABELS[r]}</option>)}</Select></Field>
            <Field label="Country or club represented" hint="As listed by the source"><Input required value={result.represented} onChange={onResult("represented")} /></Field>
          </Row>
          <Field label="Result type"><Select value={result.resultType} onChange={onResult("resultType")}>
            {RESULT_TYPES.map(t => <option key={t} value={t}>{RESULT_TYPE_LABELS[t]}</option>)}</Select></Field>
          <Row>
            <Field label={result.resultType === "ranking" ? "Rank" : needsPlacement ? "Placement" : "Placement (optional)"}>
              <Input type="number" min={1} required={needsPlacement} value={result.placement} onChange={onResult("placement")} /></Field>
            <Field label="Field size (optional)" hint="Number of entrants"><Input type="number" min={1} value={result.fieldSize} onChange={onResult("fieldSize")} /></Field>
          </Row>
          {(result.resultType === "mark") && <Row>
            <Field label="Mark"><Input required type="number" step="any" value={result.markValue} onChange={onResult("markValue")} /></Field>
            <Field label="Unit" hint="m, s, kg, pts"><Input required value={result.markUnit} onChange={onResult("markUnit")} /></Field>
          </Row>}
          {result.resultType === "stat_line" && <Field label="Stats" hint="name=value pairs, e.g. gp=30, ppg=12.4, rpg=8.1">
            <Input required value={result.stats} onChange={onResult("stats")} /></Field>}
          <Row>
            <Field label="Medal"><Select value={result.medal} onChange={onResult("medal")}>
              <option value="">None</option>{MEDALS.map(m => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}</Select></Field>
            <Field label="Result date"><Input type="date" value={result.resultDate} onChange={onResult("resultDate")} /></Field>
          </Row>
          <Field label="Source (required)" hint="Official results page or reliable publication."><Input required type="url" value={result.sourceUrl} onChange={onResult("sourceUrl")} placeholder="https://" /></Field>
          <Row>
            <Field label="Source publisher"><Input value={result.sourcePublisher} onChange={onResult("sourcePublisher")} placeholder="World Athletics" /></Field>
            <Field label="Checked on"><Input type="date" value={result.reviewedAt} onChange={onResult("reviewedAt")} /></Field>
          </Row>
          <Field label="Notes"><Input value={result.notes} onChange={onResult("notes")} placeholder="e.g. National record; tied for 3rd" /></Field>
          <Checkbox checked={result.published} onChange={v => setResult(p => ({ ...p, published: v }))} label="Published" hint="Visible only when the athlete is also published." />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={saving} className={primaryButtonClass}>{saving ? "Saving…" : result.isNew ? "Save and add another" : "Save result"}</button>
            {!result.isNew && <button type="button" disabled={saving} className={cn(dangerButtonClass, "ml-auto")} onClick={() => void removeResult()}>Delete</button>}
          </div>
        </form>}
      </SectionCard>
    </div>}

    <datalist id="intl-sports">{[...new Set(data.competitions.map(c => c.sport))].map(s => <option key={s} value={s} />)}</datalist>
  </div>;
}
