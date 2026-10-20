import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase-admin";
import type { League } from "@/types/sports";
import { canSuggestVideo, chooseVideoMatch, gameSnapshot, scoreReplay, youtubeVideoId, type ReplayChannel, type ReplayGame, type ReplayMatch } from "./match";
import { youtubeClient } from "./youtube";

export function requireReplayData<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
const errorText = (err: unknown) => err instanceof Error ? err.message : "Replay discovery failed.";

export async function runReplaySync({ db = getServiceSupabase(), manual = false, seasonId, league, now = new Date(), fetcher = fetch }: {
  db?: SupabaseClient | null; manual?: boolean; seasonId?: string; league?: League; now?: Date; fetcher?: typeof fetch;
} = {}) {
  if (!db) throw new Error("Server database access is unavailable.");
  const runId = requireReplayData(await db.rpc("begin_replay_sync", { manual, target_season: seasonId ?? null })) as string | null;
  if (!runId) return { skipped: true, reason: "Scheduled discovery is paused or another scan is running." };
  const summary = { candidates: 0, suggestions_created: 0, videos_checked: 0, links_checked: 0, units_used: 0,
    continuation: false, channels_checked: 0, errors: [] as string[] };
  const deadline = AbortSignal.timeout(45000);
  let status = "failed";
  const issue = async (id: string, code: string, message: string, gameId?: string, videoId?: string) => {
    requireReplayData(await db.from("replay_issues").upsert({ id, code, message, game_id: gameId ?? null, video_id: videoId ?? null,
      resolved: false, last_seen_at: now.toISOString() }));
  };
  try {
    if (!process.env.YOUTUBE_API_KEY) throw new Error("Set the server-only YOUTUBE_API_KEY on the app host, then redeploy.");
    const youtube = youtubeClient({ key: process.env.YOUTUBE_API_KEY, signal: deadline, fetcher, reserve: async () => {
      const allowed = requireReplayData(await db.rpc("reserve_replay_unit", { run_id: runId })) === true;
      if (allowed) summary.units_used++;
      return allowed;
    } });
    const configured = requireReplayData(await db.from("replay_channels").select("*").eq("enabled", true)) as ReplayChannel[];
    const channels = configured.filter(c => !league || c.league === league);
    if (!channels.length) throw new Error("Add an official YouTube channel for this league in Replay suggestions before scanning.");
    const games = requireReplayData(await db.rpc("replay_candidate_games", { target_season: seasonId ?? null, target_league: league ?? null })) as ReplayGame[];
    summary.candidates = games.length;
    // Eligibility already excludes pending/approved games. Read all pair
    // exclusions for the remaining games, with pagination (no 1,000-row loss).
    const previous: { game_id: string; video_id: string }[] = [];
    for (let offset = 0; games.length > 0; offset += 500) {
      const page = requireReplayData(await db.from("replay_suggestions").select("game_id,video_id").order("id").range(offset, offset + 499)) ?? [];
      previous.push(...page);
      if (page.length < 500) break;
    }
    const scope = `${seasonId ?? "recent"}:${league ?? "all"}`;
    const cursors = requireReplayData(await db.from("replay_scan_cursors").select("channel_id,next_page_token,updated_at").eq("scope", scope)) ?? [];
    const ids = [...new Set(channels.filter(c => games.some(g => g.league === c.league)).map(c => c.channel_id))]
      .sort((a, b) => (cursors.find(c => c.channel_id === a)?.updated_at ?? "").localeCompare(cursors.find(c => c.channel_id === b)?.updated_at ?? ""));
    const playlists = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 50) {
      for (const item of (await youtube.channels(ids.slice(i, i + 50))).items ?? []) {
        if (item.contentDetails?.relatedPlaylists?.uploads) playlists.set(item.id, item.contentDetails.relatedPlaylists.uploads);
      }
    }
    // Choose once per video against ALL eligible games, including other league
    // mappings of a shared broadcaster. Store only after ambiguity is checked.
    for (const channelId of ids) {
      if (deadline.aborted || summary.units_used >= 150) { summary.continuation = true; break; }
      const playlist = playlists.get(channelId);
      if (!playlist) { summary.errors.push(`Uploads playlist unavailable for ${channelId}.`); continue; }
      const mappings = channels.filter(c => c.channel_id === channelId);
      const relevant = games.filter(g => mappings.some(c => c.league === g.league));
      const earliest = Math.min(...relevant.map(g => Date.parse(g.start_time)));
      let pageToken = cursors.find(c => c.channel_id === channelId)?.next_page_token ?? undefined;
      try {
        for (let pageNumber = 0; pageNumber < 6; pageNumber++) {
          const page = await youtube.uploads(playlist, pageToken);
          const items = page.items ?? [];
          const videoIds = items.map(i => i.contentDetails?.videoId).filter((v): v is string => !!v && /^[A-Za-z0-9_-]{11}$/.test(v));
          const videos = videoIds.length ? await youtube.videos(videoIds) : [];
          summary.videos_checked += videos.length;
          const winners = new Map<string, ReplayMatch[]>();
          for (const video of videos) {
            if (video.channelId !== channelId) continue;
            const matches = relevant.flatMap(game => {
              const channel = mappings.find(c => c.league === game.league)!;
              const match = scoreReplay(game, video, channel);
              return match ? [match] : [];
            });
            winners.set(video.id, matches);
          }
          // Persist checkpoints only after suggestions from this page have
          // been stored; a failed write must not skip unprocessed videos.
          for (const [videoId, matches] of winners) {
            const chosen = chooseVideoMatch(matches);
            if (chosen.ambiguous) {
              await issue(`ambiguous:${videoId}`, "ambiguous", `Video matches multiple games equally: ${matches.map(m => m.game.id).join(", ")}. Review manually.`, undefined, videoId);
            } else if (chosen.match) {
              const m = chosen.match;
              if (canSuggestVideo(m.game.id, videoId, previous)) {
                const stored = requireReplayData(await db.rpc("store_replay_suggestion", { run_id: runId, suggestion: {
                  game_id: m.game.id, video_id: videoId, video_url: `https://www.youtube.com/watch?v=${videoId}`,
                  title: m.video.title, channel_id: channelId, channel_title: m.video.channelTitle,
                  published_at: m.video.publishedAt, duration_seconds: m.video.durationSeconds, kind: m.kind,
                  inferred_kind_reason: m.kindReason, score: m.score, match_reasons: m.reasons, match_snapshot: gameSnapshot(m.game),
                } }));
                if (stored) { summary.suggestions_created++; previous.push({ game_id: m.game.id, video_id: videoId }); }
              }
              requireReplayData(await db.from("replay_issues").update({ resolved: true }).eq("id", `ambiguous:${videoId}`));
            }
          }
          const dates = items.map(i => Date.parse(i.contentDetails?.videoPublishedAt ?? "")).filter(Number.isFinite);
          const reachedStart = dates.length > 0 && Math.min(...dates) < earliest;
          pageToken = !reachedStart ? page.nextPageToken : undefined;
          requireReplayData(await db.from("replay_scan_cursors").upsert({ channel_id: channelId, scope,
            next_page_token: pageToken ?? null, updated_at: now.toISOString() }));
          if (!pageToken) break;
          if (pageNumber === 5 || deadline.aborted) { summary.continuation = true; break; }
        }
        summary.channels_checked++;
      } catch (error) {
        const message = `${mappings[0].label}: ${errorText(error)}`;
        summary.errors.push(message);
        await issue(`channel:${channelId}`, "source", message);
        continue;
      }
      requireReplayData(await db.from("replay_issues").update({ resolved: true }).eq("id", `channel:${channelId}`));
    }

    // Weekly link audit resumes by game ID when there are more than 500 rows.
    // Missing/private/unembeddable videos are flagged, never removed.
    const settings = requireReplayData(await db.from("replay_sync_settings").select("last_dead_check_at,dead_check_cursor").eq("id", true).single());
    if (!settings) throw new Error("Replay settings are missing. Apply the replay migration.");
    if (!deadline.aborted && (!settings.last_dead_check_at || Date.parse(settings.last_dead_check_at) < now.getTime() - 7 * 86400000)) {
      let query = db.from("games").select("id,replay_url").not("replay_url", "is", null).order("id").limit(500);
      if (settings.dead_check_cursor) query = query.gt("id", settings.dead_check_cursor);
      const linked = requireReplayData(await query) ?? [];
      let processed = 0;
      for (let i = 0; i < linked.length; i += 50) {
        if (deadline.aborted || summary.units_used >= 150) break;
        const batch = linked.slice(i, i + 50);
        const ids = [...new Set(batch.map(g => youtubeVideoId(g.replay_url)).filter((id): id is string => !!id))];
        const videos = ids.length ? await youtube.videos(ids) : [];
        for (const game of batch) {
          const id = youtubeVideoId(game.replay_url);
          if (!id) continue;
          const video = videos.find(v => v.id === id);
          summary.links_checked++;
          if (!video || !video.public || !video.embeddable) await issue(`dead:${game.id}`, "dead_link", "This YouTube replay is missing, private or unavailable for embedding. Check it and replace it manually if needed.", game.id, id);
          else requireReplayData(await db.from("replay_issues").update({ resolved: true }).eq("id", `dead:${game.id}`));
        }
        processed += batch.length;
        requireReplayData(await db.from("replay_sync_settings").update({ dead_check_cursor: batch.at(-1)!.id }).eq("id", true));
      }
      if (processed === linked.length && linked.length < 500) {
        requireReplayData(await db.from("replay_sync_settings").update({ last_dead_check_at: now.toISOString(), dead_check_cursor: null }).eq("id", true));
      } else summary.continuation = true;
    }
    if (!summary.errors.length) requireReplayData(await db.from("replay_issues").update({ resolved: true }).eq("id", "run"));
    status = summary.errors.length || summary.continuation ? "partial" : "success";
    return { ...summary, status, runId };
  } catch (error) {
    summary.errors.push(errorText(error));
    await issue("run", "run", errorText(error));
    throw error;
  } finally {
    const result = await db.rpc("finish_replay_sync", { run_id: runId, result_status: status, result_summary: summary });
    if (result.error) console.error("[Replay sync] Could not close run:", result.error.message);
  }
}
