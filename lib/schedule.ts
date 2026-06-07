export interface VideoEntry {
  id: string;
  title: string;
  subreddit: string;
  videoUrl: string;
  hlsUrl: string | null;
  thumbnail: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  author: string;
  permalink: string;
  score: number;
  isGif: boolean;
}

export interface TimelineEntry {
  video: VideoEntry;
  startTime: number;
}

export interface ScheduleResult {
  timeline: TimelineEntry[];
  totalDuration: number;
}

export interface CurrentProgram {
  video: VideoEntry;
  offsetSeconds: number;
  duration: number;
}

const DEFAULT_DURATION = 60;

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const chr = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash;
}

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  const shuffled = [...arr];
  const rng = mulberry32(hashString(seed));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function dateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function secondsSinceMidnight(date: Date): number {
  return date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds() + date.getUTCMilliseconds() / 1000;
}

export function buildSchedule(videos: VideoEntry[], channelNum: number, date: Date): ScheduleResult {
  if (videos.length === 0) {
    return { timeline: [], totalDuration: 0 };
  }

  const seed = `${dateString(date)}-channel-${channelNum}`;
  const shuffled = seededShuffle(videos, seed);

  const timeline: TimelineEntry[] = [];
  let totalDuration = 0;

  for (const video of shuffled) {
    timeline.push({ video, startTime: totalDuration });
    totalDuration += video.duration ?? DEFAULT_DURATION;
  }

  return { timeline, totalDuration };
}

export function getCurrentProgram(
  schedule: ScheduleResult,
  now: Date,
): CurrentProgram | null {
  if (schedule.timeline.length === 0 || schedule.totalDuration === 0) return null;

  const elapsed = secondsSinceMidnight(now) % schedule.totalDuration;
  const timeline = schedule.timeline;

  for (let i = timeline.length - 1; i >= 0; i--) {
    if (timeline[i].startTime <= elapsed) {
      const video = timeline[i].video;
      const offset = elapsed - timeline[i].startTime;
      const duration = video.duration ?? DEFAULT_DURATION;
      return { video, offsetSeconds: offset, duration };
    }
  }

  const last = timeline[timeline.length - 1];
  const lastDuration = last.video.duration ?? DEFAULT_DURATION;
  return { video: last.video, offsetSeconds: 0, duration: lastDuration };
}

export function getChannelSchedule(
  videos: VideoEntry[],
  channelNum: number,
  date: Date,
): { schedule: ScheduleResult; program: CurrentProgram | null } {
  const schedule = buildSchedule(videos, channelNum, date);
  const program = getCurrentProgram(schedule, date);
  return { schedule, program };
}
