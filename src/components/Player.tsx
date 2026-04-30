import React, { useState } from 'react';
import {
  Heart,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';
import { useMusic } from '../context/MusicContext';

export const Player: React.FC = () => {
  const {
    playerState,
    pauseTrack,
    resumeTrack,
    nextTrack,
    previousTrack,
    setVolume,
    setCurrentTime,
    likedTracks,
    toggleLikeTrack,
  } = useMusic();

  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [shuffle, setShuffle] = useState(false);

  const formatTime = (time: number) => {
    if (!time || Number.isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handlePlayPause = () => {
    if (playerState.isPlaying) {
      pauseTrack();
    } else if (playerState.currentTrack) {
      resumeTrack();
    }
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!playerState.duration) return;
    const progressBar = event.currentTarget;
    const clickX = event.clientX - progressBar.getBoundingClientRect().left;
    const percentage = clickX / progressBar.offsetWidth;
    setCurrentTime(percentage * playerState.duration);
  };

  const progressPercent =
    playerState.duration > 0
      ? Math.min((playerState.currentTime / playerState.duration) * 100, 100)
      : 0;

  if (!playerState.currentTrack) {
    return (
      <div className="player-container">
        <div className="h-[3px] bg-white/5" />
        <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:px-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">No track selected</p>
            <p className="text-sm text-gray-400">
              Pick a track to start listening.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button className="rounded-full bg-white/5 p-2 text-gray-500" disabled>
              <SkipBack size={18} />
            </button>
            <button className="rounded-full bg-blue-primary/40 p-3 text-white/70" disabled>
              <Play size={20} />
            </button>
            <button className="rounded-full bg-white/5 p-2 text-gray-500" disabled>
              <SkipForward size={18} />
            </button>
          </div>
          <div className="hidden items-center gap-3 justify-self-end text-sm text-gray-500 md:flex">
            <Volume2 size={16} />
            <span>Volume</span>
          </div>
        </div>
      </div>
    );
  }

  const currentTrack = playerState.currentTrack;
  const isFavorite = likedTracks.some((item) => item.id === currentTrack.id);

  return (
    <div className="player-container">
      <div className="group h-[3px] cursor-pointer bg-white/5" onClick={handleProgressClick}>
        <div
          className="h-full bg-gradient-to-r from-blue-primary via-cyan-400 to-emerald-300 transition-all group-hover:brightness-110"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="px-4 py-4 md:px-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(24rem,1fr)_minmax(18rem,0.85fr)] xl:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={currentTrack.imageUrl}
              alt={currentTrack.title}
              className="h-14 w-14 rounded-2xl object-cover shadow-lg shadow-black/20"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{currentTrack.title}</p>
              <p className="truncate text-sm text-gray-400">{currentTrack.artist}</p>
              <p className="truncate text-xs text-gray-500">{currentTrack.album}</p>
            </div>
            <button
              onClick={() => toggleLikeTrack(currentTrack)}
              className={`shrink-0 rounded-full p-2 transition-colors ${
                isFavorite
                  ? 'bg-red-500/10 text-red-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-red-400'
              }`}
              title="Add to favorites"
            >
              <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="flex min-w-0 flex-col items-center justify-center gap-3">
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShuffle(!shuffle)}
                className={`rounded-full p-2 transition-colors ${
                  shuffle
                    ? 'bg-blue-primary/15 text-blue-primary'
                    : 'text-gray-400 hover:bg-white/5 hover:text-blue-primary'
                }`}
                title="Shuffle"
              >
                <Shuffle size={18} />
              </button>

              <button
                onClick={previousTrack}
                className="rounded-full p-2 text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                title="Previous"
              >
                <SkipBack size={20} />
              </button>

              <button
                onClick={handlePlayPause}
                className="rounded-full bg-white p-3 text-slate-900 shadow-lg shadow-black/20 transition-transform hover:scale-[1.03]"
                title={playerState.isPlaying ? 'Pause' : 'Play'}
              >
                {playerState.isPlaying ? (
                  <Pause size={22} fill="currentColor" />
                ) : (
                  <Play size={22} fill="currentColor" />
                )}
              </button>

              <button
                onClick={nextTrack}
                className="rounded-full p-2 text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                title="Next"
              >
                <SkipForward size={20} />
              </button>

              <button
                onClick={() => {
                  const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
                  const nextMode = modes[(modes.indexOf(repeat) + 1) % modes.length];
                  setRepeat(nextMode);
                }}
                className={`rounded-full p-2 transition-colors ${
                  repeat !== 'off'
                    ? 'bg-blue-primary/15 text-blue-primary'
                    : 'text-gray-400 hover:bg-white/5 hover:text-blue-primary'
                }`}
                title="Repeat"
              >
                <div className="flex items-center gap-1">
                  <Repeat size={18} />
                  {repeat === 'one' && <span className="text-[10px] font-bold">1</span>}
                </div>
              </button>
            </div>

            <div className="flex w-full max-w-xl items-center gap-3 text-xs text-gray-400">
              <span className="w-10 text-right">{formatTime(playerState.currentTime)}</span>
              <div
                className="group/progress h-1.5 flex-1 cursor-pointer rounded-full bg-white/10"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-primary via-cyan-400 to-emerald-300 transition-all group-hover/progress:brightness-110"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="w-10">{formatTime(playerState.duration || currentTrack.duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 xl:justify-end">
            <div className="flex flex-1 items-center gap-2 xl:max-w-[15rem] xl:flex-none">
              <Volume2 size={18} className="text-gray-400" />
              <input
                type="range"
                min="0"
                max="100"
                value={playerState.volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-blue-primary"
              />
              <span className="w-10 text-right text-xs text-gray-400">{playerState.volume}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
