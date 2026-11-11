/** One player's final record at one locals, as entered in the sheet. */
export interface ResultRow {
  /** Event date, ISO `YYYY-MM-DD`. */
  date: string;
  /** Canonical player name (after aliases are applied). */
  player: string;
  /** Name exactly as it appeared in the sheet. */
  rawPlayer: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  /** Opponents' win %, 0–100. `null` if missing or unusable. */
  owp: number | null;
  /** Opponents' opponents' win %, 0–100. `null` if missing or unusable. */
  oowp: number | null;
  /** 1-based finishing position: the row's order within its week in the sheet. */
  rank: number;
  /** Number of players at that event. */
  entrants: number;
  /** Free-text from the unnamed trailing column, if any. */
  note?: string;
  /** 1-based line number in the CSV, for error reporting. */
  line: number;
}

export type IssueSeverity = "error" | "warning";

export interface DataIssue {
  severity: IssueSeverity;
  line: number;
  message: string;
}

export interface ParseResult {
  rows: ResultRow[];
  issues: DataIssue[];
}

export interface EventResult {
  date: string;
  rank: number;
  entrants: number;
  wins: number;
  losses: number;
  draws: number;
  owp: number | null;
  oowp: number | null;
}

export interface PlayerStats {
  name: string;
  slug: string;
  events: number;
  /** Rounds with a recorded result (W + L + D). */
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  /** 3 per win, 1 per draw. */
  points: number;
  /** wins / matches, 0–1. */
  winRate: number;
  /** draws / matches, 0–1. */
  tieRate: number;
  bestFinish: number;
  averageFinish: number;
  /** Event wins (rank 1). */
  firsts: number;
  firstEvent: string;
  lastEvent: string;
  /** Chronological. */
  history: EventResult[];
}

export interface EventSummary {
  date: string;
  entrants: number;
  winner: string;
}
