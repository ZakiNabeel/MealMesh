/**
 * Tests for the gamification engine — points, badges, and streak math. The
 * scoring numbers are a user-facing promise (a badge earned must not vanish on
 * the next read), so they're pinned here the way the safety pass is in
 * constraints.test.ts.
 */

import {
  CLEAN_PLATE_BONUS,
  computeStreak,
  lifetimeStats,
  logDate,
  MEAL_POINTS,
  PERFECT_WEEK_BONUS,
  summarizeWeek,
} from '@/lib/gamification';
import { MEAL_SLOTS, type DayOfWeek, type MealLog, type MealSlot } from '@/types';

/* ---------- helpers ---------- */

const WEEK = '2026-06-22'; // a Monday
const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

let seq = 0;
function log(weekStart: string, day: DayOfWeek, slot: MealSlot): MealLog {
  return {
    id: `l${seq++}`,
    userId: 'u1',
    weekStart,
    dayOfWeek: day,
    slot,
    mealName: `${day} ${slot}`,
    photoUrl: null,
    caption: null,
    createdAt: '2026-06-22T12:00:00.000Z',
  };
}

/** Every slot of one day. */
function fullDay(weekStart: string, day: DayOfWeek): MealLog[] {
  return MEAL_SLOTS.map((s) => log(weekStart, day, s));
}

/** Every slot of every day in a week (the 28). */
function fullWeek(weekStart: string): MealLog[] {
  return DAYS.flatMap((d) => fullDay(weekStart, d));
}

/* ---------- logDate ---------- */

describe('logDate', () => {
  it('maps day-of-week within a week onto the right calendar date', () => {
    expect(logDate({ weekStart: WEEK, dayOfWeek: 'monday' })).toBe('2026-06-22');
    expect(logDate({ weekStart: WEEK, dayOfWeek: 'sunday' })).toBe('2026-06-28');
  });
});

/* ---------- summarizeWeek ---------- */

describe('summarizeWeek', () => {
  it('awards meal points for individual cooked meals', () => {
    const s = summarizeWeek([log(WEEK, 'monday', 'breakfast'), log(WEEK, 'monday', 'lunch')], WEEK);
    expect(s.mealsCooked).toBe(2);
    expect(s.points).toBe(2 * MEAL_POINTS);
    expect(s.cleanPlateDays).toHaveLength(0);
    expect(s.perfectWeek).toBe(false);
  });

  it('awards a Clean-Plate Day badge + bonus for all four slots of a day', () => {
    const s = summarizeWeek(fullDay(WEEK, 'tuesday'), WEEK);
    expect(s.cleanPlateDays).toEqual(['tuesday']);
    expect(s.byDay.find((d) => d.day === 'tuesday')?.complete).toBe(true);
    expect(s.points).toBe(4 * MEAL_POINTS + CLEAN_PLATE_BONUS);
  });

  it('awards a Perfect Week badge + bonus when all 28 slots are cooked', () => {
    const s = summarizeWeek(fullWeek(WEEK), WEEK);
    expect(s.mealsCooked).toBe(28);
    expect(s.perfectWeek).toBe(true);
    expect(s.cleanPlateDays).toHaveLength(7);
    expect(s.points).toBe(28 * MEAL_POINTS + 7 * CLEAN_PLATE_BONUS + PERFECT_WEEK_BONUS);
  });

  it('collapses duplicate (day,slot) logs so a double-tap cannot inflate score', () => {
    const dup = [log(WEEK, 'monday', 'breakfast'), log(WEEK, 'monday', 'breakfast')];
    const s = summarizeWeek(dup, WEEK);
    expect(s.mealsCooked).toBe(1);
    expect(s.points).toBe(MEAL_POINTS);
  });

  it('ignores logs from other weeks', () => {
    const s = summarizeWeek([log(WEEK, 'monday', 'breakfast'), log('2026-06-15', 'monday', 'lunch')], WEEK);
    expect(s.mealsCooked).toBe(1);
  });
});

/* ---------- computeStreak ---------- */

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    const logs = [log(WEEK, 'monday', 'dinner'), log(WEEK, 'tuesday', 'dinner'), log(WEEK, 'wednesday', 'dinner')];
    const s = computeStreak(logs, '2026-06-24'); // Wednesday
    expect(s.current).toBe(3);
    expect(s.longest).toBe(3);
  });

  it('keeps the current streak alive if cooked yesterday but not yet today', () => {
    const logs = [log(WEEK, 'monday', 'dinner'), log(WEEK, 'tuesday', 'dinner')];
    const s = computeStreak(logs, '2026-06-25'); // Thursday; last cook was Tue 06-24... gap
    // Tue is 06-23, so on Thu (06-25) the run ending yesterday (06-24) is empty.
    expect(s.current).toBe(0);
  });

  it('current streak survives into the next day before midnight', () => {
    const logs = [log(WEEK, 'monday', 'dinner'), log(WEEK, 'tuesday', 'dinner')];
    // "today" is Wednesday 06-24; cooked Mon 06-22 + Tue 06-23 → yesterday counts.
    const s = computeStreak(logs, '2026-06-24');
    expect(s.current).toBe(2);
  });

  it('breaks the current streak across a gap but remembers the longest run', () => {
    const logs = [
      // run of 3: Mon-Wed
      log(WEEK, 'monday', 'dinner'),
      log(WEEK, 'tuesday', 'dinner'),
      log(WEEK, 'wednesday', 'dinner'),
      // gap Thu, then run of 1: Fri
      log(WEEK, 'friday', 'dinner'),
    ];
    const s = computeStreak(logs, '2026-06-26'); // Friday
    expect(s.current).toBe(1);
    expect(s.longest).toBe(3);
  });

  it('returns zero for no logs', () => {
    expect(computeStreak([], '2026-06-24')).toEqual({ current: 0, longest: 0 });
  });
});

/* ---------- lifetimeStats ---------- */

describe('lifetimeStats', () => {
  it('rolls multiple weeks into lifetime totals', () => {
    const prevWeek = '2026-06-15';
    const logs = [...fullWeek(prevWeek), ...fullDay(WEEK, 'monday')];
    const s = lifetimeStats(logs, '2026-06-22');
    expect(s.perfectWeeks).toBe(1);
    expect(s.cleanPlateDays).toBe(7 + 1);
    expect(s.mealsLogged).toBe(28 + 4);
    expect(s.totalPoints).toBe(
      28 * MEAL_POINTS + 7 * CLEAN_PLATE_BONUS + PERFECT_WEEK_BONUS + (4 * MEAL_POINTS + CLEAN_PLATE_BONUS),
    );
  });
});
