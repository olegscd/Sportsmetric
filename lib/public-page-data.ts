import { cache } from "react";
import { fetchSportsData } from "@/lib/supabase-data";
import type { League } from "@/types/sports";

// Share each request's data between the layout, metadata and visible page.
export const getPlayerPageData = cache((id: string) => fetchSportsData({ playerId: id }));
export const getTeamPageData = cache((id: string) => fetchSportsData({ teamId: id }));
export const getLeaguePageData = cache((league: League) => fetchSportsData({ league }));
