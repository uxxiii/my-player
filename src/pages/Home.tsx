import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMusic } from '../context/MusicContext';
import type { Track } from '../types';
import { api } from '../lib/api';
import { buildSmartQueue, loadPersonalizedRecommendations } from '../lib/discovery';

type HomeFilter = 'all' | 'music' | 'podcasts';

const HorizontalScroller: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
    <div className="flex gap-4">
      {children}
    </div>
  </div>
);

export const Home: React.FC = () => {
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>([]);
  const [activeFilter, setActiveFilter] = useState<HomeFilter>('all');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const {
    playTrack,
    setQueue,
    likedTracks,
    playlists,
    playerState,
    recentScrobbles,
  } = useMusic();

  useEffect(() => {
    const load = async () => {
      try {
        const { tracks } = await api.getTrendingTracks();
        setTrendingTracks(tracks);
      } catch (error) {
        console.error('Failed to load trending:', error);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        const tracks = await loadPersonalizedRecommendations({
          recentScrobbles,
          likedTracks,
          fallbackArtist: playerState.currentTrack?.artist || trendingTracks[0]?.artist,
        });
        setRecommendedTracks(tracks.slice(0, 24));
      } catch (error) {
        console.error('Failed to load recommendations:', error);
      }
    };
    void loadRecommendations();
  }, [likedTracks, playerState.currentTrack?.artist, recentScrobbles, trendingTracks]);

  const recentlyPlayedTracks = useMemo(() => {
    const seen = new Set<string>();
    return recentScrobbles
      .map((entry) => entry.track)
      .filter((track) => {
        if (seen.has(track.id)) return false;
        seen.add(track.id);
        return true;
      });
  }, [recentScrobbles]);

  const jumpBackInTracks = useMemo(() => recentlyPlayedTracks.slice(0, 12), [recentlyPlayedTracks]);

  const albumsYouLike = useMemo(() => {
    const source = likedTracks.length > 0 ? likedTracks : recentlyPlayedTracks;
    const seen = new Set<string>();
    return source.filter((track) => {
      const key = `${track.album}:${track.artist}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [likedTracks, recentlyPlayedTracks]);

  const showPlaylistSections = activeFilter !== 'music';
  const showMusicSections = activeFilter !== 'podcasts';

  const toggleExpanded = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const playWithSmartQueue = async (track: Track) => {
    const queue = await buildSmartQueue({
      focusedTrack: track,
      recentScrobbles,
      likedTracks,
      excludedTrackIds: [],
    });
    setQueue(queue);
    playTrack(track);
  };

  return (
    <div className="main-content overflow-y-auto p-6">
      {/* Filter Tabs */}
      <div className="mb-8 flex gap-3">
        {(['all', 'music', 'podcasts'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setActiveFilter(value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeFilter === value
                ? 'bg-white text-black'
                : 'bg-dark-card text-gray-300 hover:bg-dark-border'
            }`}
          >
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      {/* Playlists Grid */}
      {showPlaylistSections && playlists.length > 0 && (
        <section className="mb-12">
          <div className="grid grid-cols-4 gap-4">
            {playlists.map((p) => (
              <Link
                key={p.id}
                to={`/playlist/${p.id}`}
                className="group relative h-40 overflow-hidden rounded-lg"
              >
                {p.imageUrl && (
                  <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="font-bold text-white text-sm line-clamp-1">{p.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Music Sections */}
      {showMusicSections && (
        <>
          {/* It's New Music Friday */}
          {jumpBackInTracks.length > 0 && (
            <section className="mb-12">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">It's New Music Friday!</h2>
                <button
                  onClick={() => toggleExpanded('new')}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Show all
                </button>
              </div>
              <HorizontalScroller>
                {jumpBackInTracks.slice(0, expandedSections.new ? undefined : 6).map((track, idx) => (
                  <button
                    key={track.id}
                    onClick={() => void playWithSmartQueue(track)}
                    className="w-40 shrink-0 overflow-hidden rounded-lg bg-dark-card hover:bg-dark-border transition-colors"
                  >
                    <div className="relative h-40">
                      <img src={track.imageUrl} alt={track.title} className="h-full w-full object-cover" />
                      <div
                        className="absolute top-2 left-2 h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7'][idx % 4] }}
                      >
                        {idx + 1}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-white text-sm line-clamp-2">{track.title}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{track.artist}</p>
                    </div>
                  </button>
                ))}
              </HorizontalScroller>
            </section>
          )}

          {/* Albums */}
          {albumsYouLike.length > 0 && (
            <section className="mb-12">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Albums featuring songs you like</h2>
                <button
                  onClick={() => toggleExpanded('albums')}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Show all
                </button>
              </div>
              <HorizontalScroller>
                {albumsYouLike.slice(0, expandedSections.albums ? undefined : 6).map((track, idx) => (
                  <button
                    key={track.id}
                    onClick={() => void playWithSmartQueue(track)}
                    className="w-40 shrink-0 overflow-hidden rounded-lg bg-dark-card hover:bg-dark-border transition-colors"
                  >
                    <div className="relative h-40">
                      <img src={track.imageUrl} alt={track.album} className="h-full w-full object-cover" />
                      <div
                        className="absolute top-2 left-2 h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7'][idx % 4] }}
                      >
                        ♥
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-white text-sm line-clamp-2">{track.album}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{track.artist}</p>
                    </div>
                  </button>
                ))}
              </HorizontalScroller>
            </section>
          )}
        </>
      )}
    </div>
  );
};
