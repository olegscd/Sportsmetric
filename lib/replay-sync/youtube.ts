import type { ReplayVideo } from "./match";

type YoutubeItem = {
  id: string;
  snippet?: { title?: string; description?: string; channelId?: string; channelTitle?: string; publishedAt?: string; liveBroadcastContent?: string };
  contentDetails?: { duration?: string; relatedPlaylists?: { uploads?: string }; videoId?: string; videoPublishedAt?: string };
  status?: { privacyStatus?: string; embeddable?: boolean; uploadStatus?: string };
};
type YoutubeResponse = { items?: YoutubeItem[]; nextPageToken?: string };

export function durationSeconds(duration: string): number {
  const parts = duration.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  return parts ? Math.round(+(parts[1] ?? 0) * 86400 + +(parts[2] ?? 0) * 3600 + +(parts[3] ?? 0) * 60 + +(parts[4] ?? 0)) : 0;
}

export function videoFromItem(item: YoutubeItem): ReplayVideo {
  return { id: item.id, title: item.snippet?.title ?? "", description: item.snippet?.description ?? "",
    channelId: item.snippet?.channelId ?? "", channelTitle: item.snippet?.channelTitle ?? "",
    publishedAt: item.snippet?.publishedAt ?? "", durationSeconds: durationSeconds(item.contentDetails?.duration ?? ""),
    public: item.status?.privacyStatus === "public" && item.status.uploadStatus === "processed",
    embeddable: item.status?.embeddable === true, live: item.snippet?.liveBroadcastContent !== "none" };
}

/** Only fixed YouTube endpoints; keys never appear in returned errors/logs. */
export function youtubeClient({ key, reserve, signal, fetcher = fetch }: {
  key: string; reserve: () => Promise<boolean>; signal: AbortSignal; fetcher?: typeof fetch;
}) {
  async function list(endpoint: "channels" | "playlistItems" | "videos", params: Record<string, string>): Promise<YoutubeResponse> {
    if (signal.aborted) throw new Error("Run reached its time limit. Run again to continue the scan.");
    if (!(await reserve())) throw new Error("Daily replay API budget reached (3,000 units). Try after the next Pacific midnight.");
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    Object.entries({ ...params, key }).forEach(([k, v]) => url.searchParams.set(k, v));
    let response: Response;
    try {
      response = await fetcher(url, { cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), redirect: "error" });
    } catch { throw new Error("YouTube could not be reached before the request deadline. Try again."); }
    if (!response.ok) throw new Error(`YouTube API returned HTTP ${response.status}. Check API access, quota and channel IDs.`);
    try { return await response.json() as YoutubeResponse; }
    catch { throw new Error("YouTube returned an invalid response."); }
  }
  return {
    channels: (ids: string[]) => list("channels", { part: "contentDetails", id: ids.join(","), maxResults: "50" }),
    uploads: (playlistId: string, pageToken?: string) => list("playlistItems", { part: "contentDetails", playlistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) }),
    async videos(ids: string[]) { return (await list("videos", { part: "snippet,contentDetails,status", id: ids.join(","), maxResults: "50" })).items?.map(videoFromItem) ?? []; },
  };
}
