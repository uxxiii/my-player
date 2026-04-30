import React, { useState } from 'react';
import { Clock3, Disc3, FileText, Loader2, Music, Radio, X } from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { api } from '../lib/api';

interface LyricsModalProps {
  isOpen: boolean;
  lyrics: string | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}

const LyricsModal: React.FC<LyricsModalProps> = ({ isOpen, lyrics, loading, error, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[80vh] bg-dark-card border border-dark-border rounded-2xl p-6 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Lyrics</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-blue-primary" size={32} />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full text-red-400">
              {error}
            </div>
          )}
          {lyrics && !loading && (
            <pre className="whitespace-pre-wrap break-words text-gray-200 leading-8 font-mono">
              {lyrics}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export const NowPlayingPanel: React.FC = () => {
  const { playerState, recentScrobbles } = useMusic();
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLyricsModal, setShowLyricsModal] = useState(false);

  const track = playerState.currentTrack;
  const upcomingTracks = playerState.queue.slice(playerState.currentIndex + 1, playerState.currentIndex + 6);

  const formatTime = (time: number) => {
    if (!time || Number.isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const formatPlayedAt = (value: string) =>
    new Date(value).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });

  const handleLoadLyrics = async () => {
    if (!track) return;
    setLoading(true);
    setError('');
    setShowLyricsModal(true);
    try {
      const response = await api.getLyrics(track.artist, track.title);
      setLyrics(response.lyrics || 'Lyrics not available for this track.');
    } catch (err) {
      setLyrics(null);
      setError('Lyrics not available for this track.');
      console.error('Lyrics fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <aside className="h-full w-full overflow-hidden border-l border-dark-border bg-dark-card/95 backdrop-blur-xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-dark-border px-6 pb-4 pt-6">
            <div className="mb-2 text-xs uppercase tracking-[0.25em] text-gray-500">Now Playing</div>
            <h2 className="text-lg font-semibold text-white">Details & Scrobble</h2>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {track ? (
              <>
                <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-4">
                    {track.imageUrl ? (
                      <img
                        src={track.imageUrl}
                        alt={track.title}
                        className="h-72 w-full rounded-[1.75rem] object-cover shadow-xl shadow-black/20"
                      />
                    ) : (
                      <div className="flex h-72 w-full items-center justify-center rounded-[1.75rem] bg-dark-border text-blue-primary">
                        <Music size={48} />
                      </div>
                    )}
                  </div>
                  <h3 className="truncate text-xl font-bold text-white">{track.title}</h3>
                  <p className="truncate text-gray-400">{track.artist}</p>
                  <p className="mt-1 truncate text-sm text-gray-500">{track.album}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-gray-300">
                      Live {formatTime(playerState.currentTime)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-gray-300">
                      {playerState.playbackMode === 'youtube' ? 'Full track' : 'Preview'}
                    </span>
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <Disc3 size={16} className="text-blue-primary" />
                    <span>Track Details</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3 text-gray-300">
                      <span className="text-gray-500">Duration</span>
                      <span>{formatTime(playerState.duration || track.duration)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-gray-300">
                      <span className="text-gray-500">Now at</span>
                      <span>{formatTime(playerState.currentTime)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadLyrics}
                    className="mt-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-primary text-white transition-colors hover:bg-blue-secondary"
                    title="Open lyrics"
                  >
                    <FileText size={18} />
                  </button>
                </section>

                <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <Radio size={16} className="text-blue-primary" />
                    <span>Scrobble</span>
                  </div>
                  <div className="space-y-3">
                    {recentScrobbles.length > 0 ? (
                      recentScrobbles.map((entry, index) => (
                        <div
                          key={entry.id}
                          className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/10 px-3 py-2"
                        >
                          <img
                            src={entry.track.imageUrl}
                            alt={entry.track.title}
                            className="h-11 w-11 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">{entry.track.title}</p>
                            <p className="truncate text-xs text-gray-400">{entry.track.artist}</p>
                          </div>
                          <div className="shrink-0 text-right text-xs text-gray-500">
                            <div>{index === 0 ? 'Live now' : formatPlayedAt(entry.playedAt)}</div>
                            <div className="mt-1 inline-flex items-center gap-1">
                              <Clock3 size={12} />
                              <span>{formatTime(entry.track.duration)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">Start playing tracks to build your scrobble list.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm font-semibold text-white">
                    <div className="flex items-center gap-2">
                      <Disc3 size={16} className="text-blue-primary" />
                      <span>Up Next</span>
                    </div>
                    <span className="text-xs text-gray-500">{Math.max(playerState.queue.length - playerState.currentIndex - 1, 0)} queued</span>
                  </div>

                  {upcomingTracks.length > 0 ? (
                    <div className="space-y-2">
                      {upcomingTracks.map((upcomingTrack, index) => (
                        <div
                          key={`${upcomingTrack.id}-${index}`}
                          className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/10 px-3 py-2"
                        >
                          <img
                            src={upcomingTrack.imageUrl}
                            alt={upcomingTrack.title}
                            className="h-10 w-10 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">{upcomingTrack.title}</p>
                            <p className="truncate text-xs text-gray-400">{upcomingTrack.artist}</p>
                          </div>
                          <span className="text-xs text-gray-500">{playerState.currentIndex + index + 2}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Queue a track to preview what plays next.</p>
                  )}
                </section>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
                <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-dark-border text-blue-primary">
                  <Music size={36} />
                </div>
                <p className="mb-2 font-semibold text-white">Select a track to see details</p>
                <p className="max-w-xs text-sm">This panel will show artwork, lyrics, and your latest scrobbles.</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <LyricsModal
        isOpen={showLyricsModal}
        lyrics={lyrics}
        loading={loading}
        error={error}
        onClose={() => setShowLyricsModal(false)}
      />
    </>
  );
};
