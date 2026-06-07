"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import VideoPlayer, { VideoPlayerHandle } from "./VideoPlayer";
import StaticNoise from "./StaticNoise";
import VhsTexture from "./VhsTexture";
import ChannelOverlay from "./ChannelOverlay";
import TvFrame from "./TvFrame";
import TvGuide from "./TvGuide";
import {
  type VideoEntry,
  type ScheduleResult,
  type CurrentProgram,
  buildSchedule,
  getCurrentProgram,
} from "@/lib/schedule";
import { SUBREDDITS } from "@/lib/reddit";

const NUM_CHANNELS = SUBREDDITS.length;
const STATIC_DURATION = 300;
const SYNC_INTERVAL = 2000;

function dateStringUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function TvScreen() {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [staticActive, setStaticActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentProgram, setCurrentProgram] = useState<CurrentProgram | null>(null);
  const [channelSchedules, setChannelSchedules] = useState<Map<number, ScheduleResult>>(new Map());
  const [lastBuildDate, setLastBuildDate] = useState("");

  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const staticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentVideoId = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const buildAllSchedules = useCallback(
    (vids: VideoEntry[]) => {
      if (vids.length === 0) return { schedules: new Map<number, ScheduleResult>(), dateStr: "" };

      const date = new Date();
      const dateStr = dateStringUTC(date);

      const schedules = new Map<number, ScheduleResult>();
      for (let i = 0; i < NUM_CHANNELS; i++) {
        const sub = SUBREDDITS[i];
        const channelVids = vids.filter((v) => v.subreddit.toLowerCase() === sub.toLowerCase());
        schedules.set(i, buildSchedule(channelVids, i, date));
      }
      return { schedules, dateStr };
    },
    [],
  );

  const playProgram = useCallback(
    (program: CurrentProgram) => {
      const p = playerRef.current;
      if (!p) return;

      currentVideoId.current = program.video.id;
      p.setSrc(program.video.videoUrl);
      setTimeout(() => {
        p.play(program.offsetSeconds);
      }, 100);
    },
    [],
  );

  const doTransition = useCallback(
    (channel: number, schedules: Map<number, ScheduleResult>, showStatic: boolean) => {
      setSelectedChannel(channel);
      localStorage.setItem("tv-channel", String(channel));

      const schedule = schedules.get(channel);
      if (!schedule) return;

      const program = getCurrentProgram(schedule, new Date());
      if (!program) return;

      setCurrentProgram(program);

      if (showStatic) {
        setStaticActive(true);
        if (staticTimerRef.current) clearTimeout(staticTimerRef.current);
        staticTimerRef.current = setTimeout(() => {
          setStaticActive(false);
          playProgram(program);
        }, STATIC_DURATION);
      } else {
        playProgram(program);
      }
    },
    [playProgram],
  );

  const syncCurrentProgram = useCallback(() => {
    const now = new Date();
    const dateStr = dateStringUTC(now);

    if (lastBuildDate !== dateStr && videos.length > 0) {
      const { schedules } = buildAllSchedules(videos);
      setChannelSchedules(schedules);
      setLastBuildDate(dateStr);
    }

    setSelectedChannel((ch) => {
      const s = channelSchedules.get(ch);
      if (!s) return ch;

      const program = getCurrentProgram(s, now);
      if (!program) return ch;

      if (program.video.id !== currentVideoId.current) {
        setCurrentProgram(program);
        setStaticActive(true);
        if (staticTimerRef.current) clearTimeout(staticTimerRef.current);
        staticTimerRef.current = setTimeout(() => {
          setStaticActive(false);
          playProgram(program);
        }, STATIC_DURATION);
      } else {
        setCurrentProgram(program);
      }

      return ch;
    });
  }, [lastBuildDate, videos, channelSchedules, playProgram, buildAllSchedules]);

  const handleEnded = useCallback(() => {
    if (guideOpen) return;

    const schedule = channelSchedules.get(selectedChannel);
    if (!schedule) return;

    const timeline = schedule.timeline;
    if (timeline.length === 0) return;

    const currentIdx = timeline.findIndex(
      (t) => t.video.id === currentVideoId.current,
    );
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % timeline.length : 0;
    const nextVideo = timeline[nextIdx].video;

    const nextProgram: CurrentProgram = {
      video: nextVideo,
      offsetSeconds: 0,
      duration: nextVideo.duration ?? 60,
    };

    setCurrentProgram(nextProgram);
    setStaticActive(true);
    if (staticTimerRef.current) clearTimeout(staticTimerRef.current);
    staticTimerRef.current = setTimeout(() => {
      setStaticActive(false);
      playProgram(nextProgram);
    }, STATIC_DURATION);
  }, [selectedChannel, guideOpen, playProgram, channelSchedules]);

  const changeChannel = useCallback(
    (direction: 1 | -1) => {
      const next = (selectedChannel + direction + NUM_CHANNELS) % NUM_CHANNELS;
      if (staticTimerRef.current) clearTimeout(staticTimerRef.current);
      doTransition(next, channelSchedules, true);
    },
    [selectedChannel, channelSchedules, doTransition],
  );

  const selectChannel = useCallback(
    (ch: number) => {
      if (staticTimerRef.current) clearTimeout(staticTimerRef.current);
      doTransition(ch, channelSchedules, true);
      setGuideOpen(false);
    },
    [channelSchedules, doTransition],
  );

  useEffect(() => {
    let cancelled = false;

    fetch("/api/videos")
      .then((r) => r.json())
      .then((data: VideoEntry[]) => {
        if (cancelled) return;
        setVideos(data);

        if (data.length === 0) {
          setLoaded(true);
          return;
        }

        const { schedules, dateStr } = buildAllSchedules(data);

        const saved = localStorage.getItem("tv-channel");
        const startCh = saved !== null ? parseInt(saved, 10) % NUM_CHANNELS : 0;

        const schedule = schedules.get(startCh);
        const program = schedule ? getCurrentProgram(schedule, new Date()) : null;

        setChannelSchedules(schedules);
        setLastBuildDate(dateStr);
        setSelectedChannel(startCh);
        setCurrentProgram(program);
        setLoaded(true);

        if (program) {
          initializedRef.current = true;
          playProgram(program);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [buildAllSchedules, playProgram]);

  useEffect(() => {
    if (!loaded || videos.length === 0 || !initializedRef.current) return;

    syncIntervalRef.current = setInterval(syncCurrentProgram, SYNC_INTERVAL);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [loaded, videos.length, syncCurrentProgram]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        setGuideOpen((prev) => !prev);
        return;
      }

      if (guideOpen) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        changeChannel(1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        changeChannel(-1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [guideOpen, changeChannel]);

  useEffect(() => {
    return () => {
      if (staticTimerRef.current) clearTimeout(staticTimerRef.current);
    };
  }, []);

  if (!loaded) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-green-400 font-mono text-lg animate-pulse">TUNING...</div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-green-400 font-mono text-lg">NO SIGNAL</div>
        <div className="text-green-600 font-mono text-sm">
          Run <code className="bg-green-900/30 px-2 py-0.5 rounded">npx tsx scripts/scrape.ts</code> to fetch videos
        </div>
      </div>
    );
  }

  const program = currentProgram;

  const guideChannels = Array.from({ length: NUM_CHANNELS }, (_, i) => {
    const s = channelSchedules.get(i);
    const p = s ? getCurrentProgram(s, new Date()) : null;
    return {
      num: i + 1,
      subreddit: SUBREDDITS[i],
      video: p?.video ?? null,
      offset: p?.offsetSeconds ?? 0,
      duration: p?.duration ?? 0,
      thumbnail: p?.video.thumbnail ?? null,
    };
  });

  return (
    <TvFrame>
      <div className="relative w-full h-full bg-black overflow-hidden">
        <div className="absolute inset-0">
          <VideoPlayer
            ref={playerRef}
            thumbnail={program?.video.thumbnail ?? null}
            visible={!staticActive}
            muted={muted}
            onEnded={handleEnded}
          />
        </div>

        <StaticNoise visible={staticActive} />

        <VhsTexture />

        <ChannelOverlay
          channel={selectedChannel + 1}
          visible={!guideOpen}
          subreddit={program?.video.subreddit}
          author={program?.video.author}
          showTitle={program?.video.title}
        />

        {guideOpen && (
          <TvGuide
            channels={guideChannels}
            currentChannel={selectedChannel}
            onSelect={selectChannel}
            onClose={() => setGuideOpen(false)}
          />
        )}

        <button
          onClick={() => setMuted((m) => !m)}
          className="absolute bottom-10 right-16 z-30 text-white/50 hover:text-white/90 transition-colors"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <span className="text-white/15 font-mono text-xs tracking-widest">▲▼ change channel  ·  G guide</span>
        </div>
      </div>
    </TvFrame>
  );
}
