"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { withBase } from "../lib/basePath";
import VideoPlayer, { VideoPlayerHandle } from "./VideoPlayer";
import StaticNoise from "./StaticNoise";
import VhsTexture from "./VhsTexture";
import ChannelOverlay from "./ChannelOverlay";
import TvGuide from "./TvGuide";
import RemoteControl from "./RemoteControl";
import Header from "./Header";
import {
  type VideoEntry,
  type ScheduleResult,
  type CurrentProgram,
  buildSchedule,
  getCurrentProgram,
} from "@/lib/schedule";
import { SUBREDDITS } from "@/lib/reddit";

const NUM_CHANNELS = SUBREDDITS.length;
const STATIC_MIN_DURATION = 150;
const STATIC_SAFETY = 10_000;
const SYNC_INTERVAL = 2000;
const TWO_DIGIT_TIMEOUT = 2000;

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
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentProgram, setCurrentProgram] = useState<CurrentProgram | null>(null);
  const [channelSchedules, setChannelSchedules] = useState<Map<number, ScheduleResult>>(new Map());
  const [lastBuildDate, setLastBuildDate] = useState("");
  const [showVolumeOsd, setShowVolumeOsd] = useState(false);
  const [pendingDigit, setPendingDigit] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);

  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentVideoId = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const staticStartTimeRef = useRef(0);
  const volumeOsdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeMountedRef = useRef(false);
  const pendingDigitRef = useRef<string | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildAllSchedules = useCallback(
    (vids: VideoEntry[]) => {
      if (vids.length === 0) return { schedules: new Map<number, ScheduleResult>(), dateStr: "" };

      const date = new Date();
      const dateStr = dateStringUTC(date);

      const schedules = new Map<number, ScheduleResult>();
      for (let i = 0; i < NUM_CHANNELS; i++) {
        const sub = SUBREDDITS[i];
        const channelVids = i === NUM_CHANNELS - 1 ? vids.filter((v) => v.isBest) : vids.filter((v) => v.subreddit.toLowerCase() === sub.toLowerCase());
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

  const handlePlaying = useCallback(() => {
    if (staticStartTimeRef.current === 0) return;

    const elapsed = Date.now() - staticStartTimeRef.current;
    const remaining = Math.max(0, STATIC_MIN_DURATION - elapsed);

    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    staticStartTimeRef.current = 0;

    setTimeout(() => {
      setStaticActive(false);
    }, remaining);
  }, []);

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
        staticStartTimeRef.current = Date.now();
        setStaticActive(true);
        playProgram(program);

        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = setTimeout(() => {
          setStaticActive(false);
        }, STATIC_SAFETY);
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
        staticStartTimeRef.current = Date.now();
        setStaticActive(true);
        playProgram(program);

        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = setTimeout(() => {
          setStaticActive(false);
        }, STATIC_SAFETY);
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
    staticStartTimeRef.current = Date.now();
    setStaticActive(true);
    playProgram(nextProgram);

    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    safetyTimerRef.current = setTimeout(() => {
      setStaticActive(false);
    }, STATIC_SAFETY);
  }, [selectedChannel, guideOpen, playProgram, channelSchedules]);

  const changeChannel = useCallback(
    (direction: 1 | -1) => {
      const next = (selectedChannel + direction + NUM_CHANNELS) % NUM_CHANNELS;
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      pendingDigitRef.current = null;
      setPendingDigit(null);
      doTransition(next, channelSchedules, true);
    },
    [selectedChannel, channelSchedules, doTransition],
  );

  const selectChannel = useCallback(
    (ch: number) => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
      pendingDigitRef.current = null;
      setPendingDigit(null);
      doTransition(ch, channelSchedules, true);
      setGuideOpen(false);
    },
    [channelSchedules, doTransition],
  );

  const selectChannelRef = useRef(selectChannel);
  selectChannelRef.current = selectChannel;

  const handleNumberPress = useCallback(
    (num: number) => {
      if (pendingDigitRef.current !== null) {
        if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
        const channelStr = `${pendingDigitRef.current}${num}`;
        pendingDigitRef.current = null;
        setPendingDigit(null);
        const ch = parseInt(channelStr, 10);
        if (ch >= 1 && ch <= NUM_CHANNELS) {
          selectChannelRef.current(ch - 1);
        }
      } else {
        pendingDigitRef.current = String(num);
        setPendingDigit(String(num));
        pendingTimeoutRef.current = setTimeout(() => {
          const ch = parseInt(pendingDigitRef.current!, 10);
          pendingDigitRef.current = null;
          setPendingDigit(null);
          if (ch >= 1 && ch <= NUM_CHANNELS) {
            selectChannelRef.current(ch - 1);
          }
        }, TWO_DIGIT_TIMEOUT);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    fetch(withBase("/api/videos"))
      .then((r) => (r.ok ? r.json() : fetch(withBase("/videos.json")).then((r2) => r2.json())))
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

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFullscreen((prev) => !prev);
        return;
      }

      if (e.key === "Escape" && fullscreen) {
        e.preventDefault();
        setFullscreen(false);
        return;
      }

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleNumberPress(parseInt(e.key, 10));
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
  }, [guideOpen, changeChannel, fullscreen, handleNumberPress]);

  useEffect(() => {
    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!launched || !currentProgram) return;
    staticStartTimeRef.current = Date.now();
    setStaticActive(true);
    playProgram(currentProgram);

    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    safetyTimerRef.current = setTimeout(() => {
      setStaticActive(false);
    }, STATIC_SAFETY);
  }, [launched]);

  useEffect(() => {
    if (launched || !loaded) return;
    const handleLaunch = (e: KeyboardEvent | MouseEvent) => {
      e.preventDefault();
      setLaunched(true);
    };
    window.addEventListener("keydown", handleLaunch);
    window.addEventListener("click", handleLaunch);
    return () => {
      window.removeEventListener("keydown", handleLaunch);
      window.removeEventListener("click", handleLaunch);
    };
  }, [launched, loaded]);

  useEffect(() => {
    if (!volumeMountedRef.current) {
      volumeMountedRef.current = true;
      return;
    }
    setShowVolumeOsd(true);
    if (volumeOsdTimeoutRef.current) clearTimeout(volumeOsdTimeoutRef.current);
    volumeOsdTimeoutRef.current = setTimeout(() => setShowVolumeOsd(false), 2000);
  }, [volume, muted]);

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
    return {
      num: i + 1,
      subreddit: i === NUM_CHANNELS - 1 ? "Best Of" : SUBREDDITS[i],
      timeline: s?.timeline ?? [],
      totalDuration: s?.totalDuration ?? 0,
    };
  });

  return (
    <div
      style={{ background: `url('${withBase("/bg2.png")}') center/cover no-repeat` }}
      className="min-h-screen flex flex-col items-center justify-start font-sans relative overflow-hidden"
    >
      {!fullscreen && (
        <>
          <div className="h-[4vh]" />
          <Header />
        </>
      )}

      <div className="flex-1 flex flex-col items-center justify-center w-full p-8">
        {/* Outer wrapper: in fullscreen becomes fixed, otherwise flex layout */}
        <div
          className={fullscreen ? "fixed inset-0 z-50" : "w-full max-w-4xl flex justify-center z-10"}
        >
          <div
            className={
              fullscreen
                ? "relative w-full h-full"
                : "relative w-full max-w-[900px] flex items-center justify-center"
            }
          >
            <div
              className={fullscreen ? "w-full h-full" : "relative w-full"}
              style={fullscreen ? {} : { aspectRatio: "1379/985" }}
            >
              <div
                className="absolute bg-black overflow-hidden"
                style={
                  fullscreen
                    ? { inset: 0 }
                    : {
                        top: "5.7%",
                        right: "4.7%",
                        bottom: "4.5%",
                        left: "3.4%",
                        borderRadius: "12px",
                      }
                }
              >
                <div className="absolute inset-0">
                  <VideoPlayer
                    ref={playerRef}
                    thumbnail={program?.video.thumbnail ?? null}
                    fullscreen={fullscreen}
                    visible={!staticActive}
                    muted={muted}
                    volume={volume}
                    onEnded={handleEnded}
                    onPlaying={handlePlaying}
                  />

                  {(showVolumeOsd || muted) && (
                    <div className="absolute bottom-10 left-20 z-40 font-mono drop-shadow-[0_0_8px_rgba(74,222,128,0.6)]">
                      <div className="text-sm tracking-widest text-green-400/80 mb-1.5">VOLUME</div>
                      <div className="flex gap-[8px]">
                        {muted ? (
                          <div className="text-base tracking-widest text-green-400/60">MUTE</div>
                        ) : (
                          Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className="w-[12px] h-12 rounded-[3px]"
                              style={{
                                backgroundColor: i < Math.round(volume * 10) ? "#4ade80" : "#1a3a1a",
                                boxShadow:
                                  i < Math.round(volume * 10)
                                    ? "0 0 8px rgba(74,222,128,0.6)"
                                    : "none",
                              }}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <StaticNoise visible={staticActive} />

                <VhsTexture />

                <ChannelOverlay
                  channel={selectedChannel + 1}
                  visible={fullscreen ? true : !guideOpen}
                  subreddit={program?.video.subreddit}
                  pendingDigits={pendingDigit}
                  totalChannels={NUM_CHANNELS}
                />

                {guideOpen && (
                  <TvGuide
                    channels={guideChannels}
                    currentChannel={selectedChannel}
                    currentProgram={program}
                    onSelect={selectChannel}
                    onClose={() => setGuideOpen(false)}
                  />
                )}

                {!launched && (
                  <div className="absolute inset-0 z-40 w-full h-full bg-black flex flex-col items-center justify-center gap-6 overflow-hidden">
                    <div className="absolute inset-0 opacity-10" style={{ background: `url('${withBase("/bg2.png")}') center/cover no-repeat` }} />
                    <div className="relative z-10 flex flex-col items-center gap-5 max-w-sm px-5 text-center">
                      <div className="text-green-500/60 font-mono text-[10px] tracking-[0.3em] animate-pulse">
                        ● BROADCAST INITIALIZING ●
                      </div>
                      <h1 className="text-green-400 text-2xl font-mono tracking-wide leading-tight">
                        INTERDIMENSIONAL<br />CABLE
                      </h1>
                      <div className="h-px w-24 bg-green-800/50" />
                      <p className="text-green-300/70 font-mono text-xs leading-relaxed">
                        You have tuned into a television signal from an adjacent dimension. Our
                        programming consists entirely of AI-generated videos scraped from
                        Reddit. We are not responsible for any existential dread, temporal
                        displacement, or spontaneous third-eye activation.
                      </p>
                      <div className="text-green-500/40 font-mono text-[10px] leading-relaxed">
                        No subscription required. No refunds possible.<br />
                        The signal finds <em>you</em>.
                      </div>
                      <button
                        onClick={() => setLaunched(true)}
                        className="mt-2 px-6 py-2 bg-green-900/40 border border-green-500/50 text-green-400 font-mono text-sm tracking-widest hover:bg-green-800/50 hover:border-green-400/70 active:scale-95 transition-all rounded cursor-pointer"
                      >
                        ▶ START BROADCAST
                      </button>
                      <div className="text-green-600/30 font-mono text-[10px] tracking-wider">
                        PRESS ANY KEY OR CLICK
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!fullscreen && (
                <img
                  src={withBase("/tv-frame.png")}
                  alt=""
                  className="absolute inset-0 w-full h-full pointer-events-none select-none"
                  style={{
                    objectFit: "contain",
                    zIndex: 50,
                    borderRadius: "12px",
                    border: "2px solid #333",
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {!fullscreen && (
          <div className="mt-8 lg:mt-0 lg:absolute lg:right-10 lg:bottom-10 z-20 self-center lg:self-auto pb-8 lg:pb-0">
            <RemoteControl
              onNumberPress={handleNumberPress}
              onChannelUp={() => changeChannel(1)}
              onChannelDown={() => changeChannel(-1)}
              onVolumeUp={() => setVolume((v) => Math.min(1, v + 0.1))}
              onVolumeDown={() => setVolume((v) => Math.max(0, v - 0.1))}
              onMuteToggle={() => setMuted((m) => !m)}
              onGuidePress={() => setGuideOpen((v) => !v)}
              onEnterPress={() => setFullscreen((f) => !f)}
              isMuted={muted}
            />
          </div>
        )}
      </div>
    </div>
  );
}
