/**
 * Gamification engine — points, badges, and streaks derived from cooking logs.
 *
 * Pure and dependency-free (no `any`, no I/O), like `src/lib/constraints.ts`,
 * so the reward math is deterministic and unit-tested (`gamification.test.ts`).
 * Everything here is computed ON READ from `MealLog[]` — the database stores
 * only the raw logs, never a derived score, so a scoring tweak can never leave
 * a user with a stale total.
 *
 * The loop it powers:
 *   cook a meal            → +MEAL_POINTS
 *   cook all 4 of a day    → "Clean-Plate Day" badge + CLEAN_PLATE_BONUS
 *   cook all 28 of a week  → "Perfect Week" badge + PERFECT_WEEK_BONUS
 *   cook on consecutive days → a streak (Duolingo-style daily habit)
 */

import { MEAL_SLOTS, type DayOfWeek, type MealLog, type MealSlot } from '@/types';

/** Monday-first order so a "week" and a streak read left-to-right. */
export const DAY_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const MEAL_POINTS = 10;
export const CLEAN_PLATE_BONUS = 20;
export const PERFECT_WEEK_BONUS = 100;

/** The four meal slots that make a full day. */
const SLOTS_PER_DAY = MEAL_SLOTS.length; // 4

export type BadgeKind = 'clean_plate_day' | 'perfect_week';

export interface DayProgress {
  day: DayOfWeek;
  /** Which slots were cooked, in slot order. */
  cookedSlots: MealSlot[];
  /** True when all four slots are cooked (earns a Clean-Plate Day badge). */
  complete: boolean;
}

export interface WeekSummary {
  /** Total points earned in this week (meals + day/week bonuses). */
  points: number;
  mealsCooked: number;
  byDay: DayProgress[];
  /** Days that earned a Clean-Plate badge (all 4 slots). */
  cleanPlateDays: DayOfWeek[];
  /** True only when every one of the 28 slots was cooked. */
  perfectWeek: boolean;
}

export interface StreakResult {
  /** Consecutive days up to & including the reference day with ≥1 meal cooked. */
  current: number;
  /** The longest such run anywhere in the supplied history. */
  longest: number;
}

/* ------------------------------------------------------------------ */
/* Dates                                                              */
/* ------------------------------------------------------------------ */

/** Add `days` to a `YYYY-MM-DD` date in UTC, returning `YYYY-MM-DD`. */
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The real calendar date (`YYYY-MM-DD`) a log falls on. */
export function logDate(log: Pick<MealLog, 'weekStart' | 'dayOfWeek'>): string {
  const idx = DAY_ORDER.indexOf(log.dayOfWeek);
  return addDaysIso(log.weekStart, idx < 0 ? 0 : idx);
}

/* ------------------------------------------------------------------ */
/* Per-week summary                                                   */
/* ------------------------------------------------------------------ */

/**
 * Summarize one plan week. Only logs whose `weekStart` matches `weekStart` are
 * counted; a duplicate (same day+slot) is collapsed so a double-tap can't
 * inflate the score. Order of the input does not matter.
 */
export function summarizeWeek(logs: MealLog[], weekStart: string): WeekSummary {
  // day -> set of cooked slots (deduped).
  const cooked = new Map<DayOfWeek, Set<MealSlot>>();
  for (const day of DAY_ORDER) cooked.set(day, new Set());

  for (const log of logs) {
    if (log.weekStart !== weekStart) continue;
    const slots = cooked.get(log.dayOfWeek);
    if (slots && MEAL_SLOTS.includes(log.slot)) slots.add(log.slot);
  }

  const byDay: DayProgress[] = DAY_ORDER.map((day) => {
    const slots = cooked.get(day) ?? new Set<MealSlot>();
    const cookedSlots = MEAL_SLOTS.filter((s) => slots.has(s));
    return { day, cookedSlots, complete: cookedSlots.length === SLOTS_PER_DAY };
  });

  const mealsCooked = byDay.reduce((sum, d) => sum + d.cookedSlots.length, 0);
  const cleanPlateDays = byDay.filter((d) => d.complete).map((d) => d.day);
  const perfectWeek = mealsCooked === DAY_ORDER.length * SLOTS_PER_DAY;

  const points =
    mealsCooked * MEAL_POINTS +
    cleanPlateDays.length * CLEAN_PLATE_BONUS +
    (perfectWeek ? PERFECT_WEEK_BONUS : 0);

  return { points, mealsCooked, byDay, cleanPlateDays, perfectWeek };
}

/* ------------------------------------------------------------------ */
/* Streaks (cross-week, calendar-based)                               */
/* ------------------------------------------------------------------ */

/**
 * A cooking streak = consecutive calendar days on which the user cooked at
 * least one meal. Works across week boundaries (operates on real dates, not a
 * single plan week). `current` is the run ending today OR yesterday — cooking
 * yesterday but not yet today keeps the streak alive until the day ends.
 */
export function computeStreak(logs: MealLog[], todayIso: string): StreakResult {
  const days = new Set<string>();
  for (const log of logs) days.add(logDate(log));
  if (days.size === 0) return { current: 0, longest: 0 };

  const sorted = [...days].sort(); // ISO dates sort lexicographically = chronologically

  // Longest run of consecutive days anywhere in history.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = addDaysIso(sorted[i - 1], 1) === sorted[i] ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // Current run: walk backwards from today (or yesterday) while days are present.
  let current = 0;
  let cursor = days.has(todayIso) ? todayIso : addDaysIso(todayIso, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = addDaysIso(cursor, -1);
  }

  return { current, longest };
}

/* ------------------------------------------------------------------ */
/* Lifetime totals (across all weeks)                                 */
/* ------------------------------------------------------------------ */

export interface LifetimeStats {
  totalPoints: number;
  mealsLogged: number;
  cleanPlateDays: number;
  perfectWeeks: number;
  streak: StreakResult;
}

/** Roll every week up into the lifetime totals shown on a profile. */
export function lifetimeStats(logs: MealLog[], todayIso: string): LifetimeStats {
  const weeks = new Set<string>();
  for (const log of logs) weeks.add(log.weekStart);

  let totalPoints = 0;
  let cleanPlateDays = 0;
  let perfectWeeks = 0;
  for (const week of weeks) {
    const s = summarizeWeek(logs, week);
    totalPoints += s.points;
    cleanPlateDays += s.cleanPlateDays.length;
    if (s.perfectWeek) perfectWeeks += 1;
  }

  // mealsLogged counts distinct (week,day,slot) cells, matching how points are
  // awarded (deduped), so a stray duplicate row never skews the lifetime count.
  const cells = new Set<string>();
  for (const log of logs) {
    if (MEAL_SLOTS.includes(log.slot) && DAY_ORDER.includes(log.dayOfWeek)) {
      cells.add(`${log.weekStart}|${log.dayOfWeek}|${log.slot}`);
    }
  }

  return {
    totalPoints,
    mealsLogged: cells.size,
    cleanPlateDays,
    perfectWeeks,
    streak: computeStreak(logs, todayIso),
  };
}
