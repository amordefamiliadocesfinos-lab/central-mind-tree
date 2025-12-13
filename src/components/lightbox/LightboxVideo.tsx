import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  PictureInPicture,
  Camera,
  SkipBack,
  SkipForward,
} from "lucide-react";

interface LightboxVideoProps {
  src: string;
  onSnapshot?: (dataUrl: string) => void;
}

export function LightboxVideo({ src, onSnapshot }: LightboxVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPlaying]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
  }, []);

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  }, [duration]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const changeVolume = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    setVolume(v);
    if (v > 0 && isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, [isMuted]);

  const changeSpeed = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      await video.requestPictureInPicture();
    }
  }, []);

  const takeSnapshot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");

    if (onSnapshot) {
      onSnapshot(dataUrl);
    } else {
      // Download directly
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `snapshot-${Date.now()}.png`;
      a.click();
    }
  }, [onSnapshot]);

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={src}
          className="max-w-full max-h-full"
          onClick={togglePlay}
        />
      </div>

      {/* Controls Footer */}
      <div className="flex flex-col gap-2 p-3 bg-background/80 backdrop-blur border-t border-border">
        {/* Progress Bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs w-12 text-muted-foreground">{formatTime(currentTime)}</span>
          <Slider
            value={[currentTime]}
            onValueChange={([v]) => seek(v)}
            min={0}
            max={duration || 100}
            step={0.1}
            className="flex-1"
          />
          <span className="text-xs w-12 text-muted-foreground text-right">{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => skip(-5)} title="Voltar 5s">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => skip(5)} title="Avançar 5s">
            <SkipForward className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border" />

          <Button variant="ghost" size="icon" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            onValueChange={([v]) => changeVolume(v)}
            min={0}
            max={1}
            step={0.1}
            className="w-20"
          />

          <div className="w-px h-6 bg-border" />

          <select
            value={playbackRate}
            onChange={(e) => changeSpeed(Number(e.target.value))}
            className="text-xs bg-transparent border border-border rounded px-2 py-1"
          >
            {speeds.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>

          <div className="w-px h-6 bg-border" />

          <Button variant="ghost" size="icon" onClick={takeSnapshot} title="Snapshot">
            <Camera className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="Fullscreen">
            <Maximize className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={togglePiP} title="Picture in Picture">
            <PictureInPicture className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
