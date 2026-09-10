import { Crown, Swords, Volleyball as VolleyballIcon } from "lucide-react";

type IconProps = { className?: string };

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function BasketballIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93c4.24 4.24 4.24 11.1 0 15.34" />
      <path d="M19.07 4.93c-4.24 4.24-4.24 11.1 0 15.34" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function BadmintonIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} className={className}>
      <path d="M12 2l4 7-8 0z" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="15" x2="12" y2="22" />
      <line x1="8" y1="19" x2="16" y2="19" />
    </svg>
  );
}

function TableTennisIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} className={className}>
      <circle cx="11" cy="9" r="6" />
      <path d="M16 13l5 5a2 2 0 0 1-2.83 2.83l-5-5" />
      <circle cx="18" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}

function MartialArtsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} className={className}>
      <path d="M6 4h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M9 11v9l3-3 3 3v-9" />
    </svg>
  );
}

function BaseballIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M5.5 5.5c3.5 3.5 3.5 9.5 0 13" strokeDasharray="2 2" />
      <path d="M18.5 5.5c-3.5 3.5-3.5 9.5 0 13" strokeDasharray="2 2" />
    </svg>
  );
}

function FootballIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} className={className}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="12,8 15,10 14,14 10,14 9,10" fill="currentColor" fillOpacity="0.2" />
      <line x1="12" y1="8" x2="12" y2="2" />
      <line x1="15" y1="10" x2="20" y2="7" />
      <line x1="14" y1="14" x2="18" y2="18" />
      <line x1="10" y1="14" x2="6" y2="18" />
      <line x1="9" y1="10" x2="4" y2="7" />
    </svg>
  );
}

function TennisIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93a10 10 0 0 1 14.14 0" />
      <path d="M4.93 19.07a10 10 0 0 0 14.14 0" />
    </svg>
  );
}

function SwimmingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} className={className}>
      <path d="M2 18c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1" />
      <path d="M2 21c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1" />
      <circle cx="18" cy="6" r="3" />
      <path d="M7 12l5-4 5 3-3 4" />
    </svg>
  );
}

export interface SportMeta {
  name: string;
  slug: string;
  icon: React.ComponentType<IconProps>;
  color: string;
  bgGlow: string;
  isFeatured?: boolean;
}

export const SPORTS_META: SportMeta[] = [
  {
    name: "General Championship",
    slug: "general-championship",
    icon: Crown,
    color: "text-amber-400",
    bgGlow: "group-hover:border-amber-400/60 group-hover:bg-amber-400/10",
    isFeatured: true,
  },
  {
    name: "Basketball",
    slug: "basketball",
    icon: BasketballIcon,
    color: "text-amber-500",
    bgGlow: "group-hover:border-amber-500/60 group-hover:bg-amber-500/5",
  },
  {
    name: "Volleyball",
    slug: "volleyball",
    icon: VolleyballIcon,
    color: "text-sky-400",
    bgGlow: "group-hover:border-sky-500/60 group-hover:bg-sky-500/5",
  },
  {
    name: "Badminton",
    slug: "badminton",
    icon: BadmintonIcon,
    color: "text-emerald-400",
    bgGlow: "group-hover:border-emerald-500/60 group-hover:bg-emerald-500/5",
  },
  {
    name: "Table Tennis",
    slug: "table-tennis",
    icon: TableTennisIcon,
    color: "text-orange-400",
    bgGlow: "group-hover:border-orange-500/60 group-hover:bg-orange-500/5",
  },
  {
    name: "Tae Kwon Do",
    slug: "tae-kwon-do",
    icon: MartialArtsIcon,
    color: "text-red-400",
    bgGlow: "group-hover:border-red-500/60 group-hover:bg-red-500/5",
  },
  {
    name: "Judo",
    slug: "judo",
    icon: MartialArtsIcon,
    color: "text-indigo-400",
    bgGlow: "group-hover:border-indigo-500/60 group-hover:bg-indigo-500/5",
  },
  {
    name: "Baseball",
    slug: "baseball",
    icon: BaseballIcon,
    color: "text-rose-400",
    bgGlow: "group-hover:border-rose-500/60 group-hover:bg-rose-500/5",
  },
  {
    name: "Softball",
    slug: "softball",
    icon: BaseballIcon,
    color: "text-yellow-400",
    bgGlow: "group-hover:border-yellow-500/60 group-hover:bg-yellow-500/5",
  },
  {
    name: "Football",
    slug: "football",
    icon: FootballIcon,
    color: "text-teal-400",
    bgGlow: "group-hover:border-teal-500/60 group-hover:bg-teal-500/5",
  },
  {
    name: "Fencing",
    slug: "fencing",
    icon: Swords,
    color: "text-purple-400",
    bgGlow: "group-hover:border-purple-500/60 group-hover:bg-purple-500/5",
  },
  {
    name: "Chess",
    slug: "chess",
    icon: Crown,
    color: "text-amber-300",
    bgGlow: "group-hover:border-amber-400/60 group-hover:bg-amber-400/5",
  },
  {
    name: "Lawn Tennis",
    slug: "lawn-tennis",
    icon: TennisIcon,
    color: "text-lime-400",
    bgGlow: "group-hover:border-lime-500/60 group-hover:bg-lime-500/5",
  },
  {
    name: "Swimming",
    slug: "swimming",
    icon: SwimmingIcon,
    color: "text-cyan-400",
    bgGlow: "group-hover:border-cyan-500/60 group-hover:bg-cyan-500/5",
  },
];

export function findSportMeta(param: string | null): SportMeta | null {
  if (!param) return null;
  const value = param.toLowerCase();
  return (
    SPORTS_META.find(
      (s) =>
        s.name.toLowerCase() === value ||
        s.slug === value ||
        (s.name === "Tae Kwon Do" && value === "taekwondo") ||
        (s.name === "Lawn Tennis" && value === "tennis")
    ) ?? null
  );
}

/** UAAP Season 1 was 1938-1939, so the season number is the start year minus 1937. */
export function formatSeasonLabel(season: string): {
  label: string;
  seasonNumber: string;
  year: string;
} {
  const startYear = parseInt(season.split("-")[0], 10);
  if (Number.isNaN(startYear)) {
    return { seasonNumber: season, year: season, label: season };
  }
  const seasonNum = startYear - 1937;
  return {
    seasonNumber: `Season ${seasonNum}`,
    year: season,
    label: `Season ${seasonNum} (${season})`,
  };
}
