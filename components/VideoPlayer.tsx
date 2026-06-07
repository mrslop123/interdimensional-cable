"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import Hls from "hls.js";

export interface VideoPlayerHandle {
  setSrc: (src: string) => void;
  loadSrc: (src: string) => void;
  play: (startTime: number) => void;
}

interface VideoPlayerProps {
  thumbnail: string | null;
  visible: boolean;
  muted: boolean;
  onEnded?: () => void;
}

function isHlsUrl(src: string): boolean {
  return src.endsWith(".m3u8") || src.includes(".m3u8");
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({ thumbnail, visible, muted, onEnded }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const currentSrc = useRef("");
    function destroyHls() {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    }

    function attachHls(el: HTMLVideoElement, src: string) {
      destroyHls();
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(el);
        hlsRef.current = hls;
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        el.src = src;
      }
    }

    useImperativeHandle(ref, () => ({
      loadSrc(src: string) {
        const el = videoRef.current;
        if (!el || currentSrc.current === src) return;
        currentSrc.current = src;
        destroyHls();
        el.src = "";
        if (isHlsUrl(src)) {
          attachHls(el, src);
        } else {
          el.src = src;
          el.load();
        }
      },
      setSrc(src: string) {
        const el = videoRef.current;
        if (!el || currentSrc.current === src) return;
        currentSrc.current = src;
        destroyHls();
        el.src = "";
        if (isHlsUrl(src)) {
          attachHls(el, src);
        } else {
          el.src = src;
          el.load();
          el.play().catch(() => {});
        }
      },
      play(startTime: number) {
        const el = videoRef.current;
        if (!el) return;
        const doPlay = () => {
          el.currentTime = startTime;
          el.play().catch(() => {});
        };
        if (el.readyState >= 1) {
          doPlay();
        } else {
          el.addEventListener("loadedmetadata", doPlay, { once: true });
        }
      },
    }));

    useEffect(() => {
      const el = videoRef.current;
      if (!el) return;

      if (visible) {
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    }, [visible]);

    useEffect(() => {
      const el = videoRef.current;
      if (!el || !onEnded) return;

      const handleEnded = () => {
        if (visible) onEnded();
      };
      el.addEventListener("ended", handleEnded);
      return () => el.removeEventListener("ended", handleEnded);
    }, [visible, onEnded]);

    useEffect(() => {
      return () => destroyHls();
    }, []);

    return (
      <div className="absolute inset-0" style={{ display: visible ? "block" : "none" }}>
        {thumbnail && (
          <img
            src={thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <video
          ref={videoRef}
          muted={muted}
          preload="auto"
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => {
            console.warn("Video failed to load:", currentSrc.current);
          }}
        />
      </div>
    );
  },
);

export default VideoPlayer;
