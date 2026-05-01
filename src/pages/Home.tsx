import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMusic } from '../context/MusicContext';
import type { Track } from '../types';
import { api } from '../lib/api';
import { buildSmartQueue, loadPersonalizedRecommendations } from '../lib/discovery';

type HomeFilter = 'all' | 'music' | 'playlists' | 'podcasts';

const HorizontalScroller: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
    <div className="inline-flex min-w-max gap-4 px-1">
      {children}
    </div>
  </div>
);

export const Home: React.FC = () => {
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
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
      } finally {
        setLoading(false);
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

  const toggleExpanded = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const playWithSmartQueue = async (track: Track, excludedTrackIds: string[] = []) => {
    const queue = await buildSmartQueue({
      focusedTrack: track,
      recentScrobbles,
      likedTracks,
      excludedTrackIds,
    });

    setQueue(queue);
    playTrack(track);
  };

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

  const topArtists = useMemo(() => {
    const counts = new Map<string, { artist: string; imageUrl: string }>();
    const totals = new Map<string, number>();

    recentScrobbles.forEach((entry) => {
      counts.set(entry.track.artist, {
        artist: entry.track.artist,
        imageUrl: entry.track.imageUrl,
      });
      totals.set(entry.track.artist, (totals.get(entry.track.artist) ?? 0) + 1);
    });

    return [...counts.values()]
      .sort((left, right) => (totals.get(right.artist) ?? 0) - (totals.get(left.artist) ?? 0))
      .slice(0, 10);
  }, [recentScrobbles]);

  const moreOfWhatYouLike = useMemo(() => recommendedTracks.slice(0, 10), [recommendedTracks]);
  const basedOnRecentListening = useMemo(
    () => recommendedTracks.slice(10, 20).concat(trendingTracks).slice(0, 10),
    [recommendedTracks, trendingTracks]
  );
  const todaysBiggestHits = useMemo(() => trendingTracks.slice(0, 10), [trendingTracks]);

  const visibleJumpBackIn = expandedSections.jumpBackIn ? jumpBackInTracks : jumpBackInTracks.slice(0, 6);
  const visibleAlbumsYouLike = expandedSections.albums ? albumsYouLike : albumsYouLike.slice(0, 8);
  const visibleRecents = expandedSections.recents ? recentlyPlayedTracks : recentlyPlayedTracks.slice(0, 8);
  const visibleTopArtists = expandedSections.topArtists ? topArtists : topArtists.slice(0, 5);
  const visibleMoreOfWhatYouLike = expandedSections.moreLike ? moreOfWhatYouLike : moreOfWhatYouLike.slice(0, 8);
  const visibleBasedOnRecent = expandedSections.basedOnRecent ? basedOnRecentListening : basedOnRecentListening.slice(0, 8);
  const visibleHits = expandedSections.hits ? todaysBiggestHits : todaysBiggestHits.slice(0, 8);

  const showPlaylistSections = activeFilter !== 'music';
  const showMusicSections = activeFilter !== 'playlists' && activeFilter !== 'podcasts';

  return (
    <div className="main-content min-w-0 max-w-full overflow-x-hidden p-6">
      <div className="mb-8 flex flex-wrap gap-3">
        {([
          ['all', 'All'],
          ['music', 'Music'],
          ['playlists', 'Playlists'],
          ['podcasts', 'Podcasts'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveFilter(value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeFilter === value
                ? 'bg-white text-slate-900'
                : 'bg-dark-card text-gray-300 hover:bg-dark-border hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showPlaylistSections && (
        <section className="mb-12 min-w-0 max-w-full">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {playlists.length > 0 ? (
              playlists.map((playlist) => (
                <Link
                  key={playlist.id}
                  to={`/playlist/${playlist.id}`}
                  className="group flex items-center overflow-hidden rounded-xl bg-dark-card transition-colors hover:bg-dark-border"
                >
                  {playlist.imageUrl ? (
                    <img src={playlist.imageUrl} alt={playlist.name} className="h-16 w-16 object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center bg-gradient-to-br from-blue-primary/35 to-cyan-400/20 text-blue-100">
                      <Disc3 size={24} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 px-4">
                    <p className="truncate font-semibold text-white">{playlist.name}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-dark-border bg-dark-card/70 px-5 py-10 text-center text-gray-400">
                Create a playlist to pin your favorite collections here.
              </div>
            )}
          </div>
        </section>
      )}

  return (
    <div className="main-content min-w-0 max-w-full overflow-x-hidden p-6">
      <div className="mb-8 flex flex-wrap gap-3">
        {([
          ['all', 'All'],
          ['music', 'Music'],
          ['playlists', 'Playlists'],
          ['podcasts', 'Podcasts'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveFilter(value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeFilter === value
                ? 'bg-white text-slate-900'
                : 'bg-dark-card text-gray-300 hover:bg-dark-border hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showPlaylistSections && (
        <section className="mb-12 min-w-0 max-w-full">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {playlists.length > 0 ? (
              playlists.map((playlist) => (
                <Link
                  key={playlist.id}
                  to={`/playlist/${playlist.id}`}
                  className="group flex items-end overflow-hidden rounded-lg bg-dark-card transition-all hover:bg-dark-border h-32"
                >
                  {playlist.imageUrl && (
                    <img src={playlist.imageUrl} alt={playlist.name} className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  )}
                  <div className="relative w-full px-4 pb-3 pt-16 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="font-bold text-white line-clamp-2">{playlist.name}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 rounded-lg border border-dashed border-dark-border bg-dark-card/70 px-5 py-10 text-center text-gray-400">
                Create a playlist to pin your favorite collections here.
              </div>
            )}
          </div>
        </section>
      )}

      {showMusicSections && (
        <>
          <section className="mb-12 min-w-0 max-w-full">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">It's New Music Friday!</h2>
              {jumpBackInTracks.length > 6 && (
                <button
                  type="button"
                  onClick={() => toggleExpanded('jumpBackIn')}
                  className="text-sm font-semibold text-gray-400 transition-colors hover:text-white"
                >
                  Show all
                </button>
              )}
            </div>
            <HorizontalScroller>
              {visibleJumpBackIn.map((track) => (
                <button
                  key={`jump-${track.id}`}
                  type="button"
                  onClick={() => void playWithSmartQueue(track)}
                  className="w-40 shrink-0 overflow-hidden rounded-lg bg-dark-card text-left transition-all hover:bg-dark-border group"
                >
                  <div className="relative overflow-hidden h-40">
                    <img 
                      src={track.imageUrl} 
                      alt={track.title} 
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-white text-sm line-clamp-2">{track.title}</p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{track.artist}</p>
                  </div>
                </button>
              ))}
            </HorizontalScroller>
          </section>

          <section className="mb-12 min-w-0 max-w-full">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Albums featuring songs you like</h2>
              {albumsYouLike.length > 8 && (
                <button
                  type="button"
                  onClick={() => toggleExpanded('albums')}
                  className="text-sm font-semibold text-gray-400 transition-colors hover:text-white"
                >
                  Show all
                </button>
              )}
            </div>
            <HorizontalScroller>
              {visibleAlbumsYouLike.map((track) => (
                <button
                  key={`album-${track.id}`}
                  type="button"
                  onClick={() => void playWithSmartQueue(track)}
                  className="w-40 shrink-0 overflow-hidden rounded-lg bg-dark-card text-left transition-all hover:bg-dark-border group"
                >
                  <div className="relative overflow-hidden h-40">
                    <img 
                      src={track.imageUrl} 
                      alt={track.album} 
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-white text-sm line-clamp-2">{track.album}</p>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{track.artist}</p>
                  </div>
                </button>
              ))}
            </HorizontalScroller>
          </section>

          {recentlyPlayedTracks.length > 0 && (
            <section className="mb-12 min-w-0 max-w-full">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Recently played</h2>
                {recentlyPlayedTracks.length > 8 && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded('recents')}
                    className="text-sm font-semibold text-gray-400 transition-colors hover:text-white"
                  >
                    Show all
                  </button>
                )}
              </div>
              <HorizontalScroller>
                {visibleRecents.map((track) => (
                  <button
                    key={`recent-${track.id}`}
                    type="button"
                    onClick={() => void playWithSmartQueue(track)}
                    className="w-40 shrink-0 overflow-hidden rounded-lg bg-dark-card text-left transition-all hover:bg-dark-border group"
                  >
                    <div className="relative overflow-hidden h-40">
                      <img 
                        src={track.imageUrl} 
                        alt={track.title} 
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
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

          {moreOfWhatYouLike.length > 0 && (
            <section className="mb-12 min-w-0 max-w-full">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">More of what you like</h2>
                {moreOfWhatYouLike.length > 8 && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded('moreLike')}
                    className="text-sm font-semibold text-gray-400 transition-colors hover:text-white"
                  >
                    Show all
                  </button>
                )}
              </div>
              <HorizontalScroller>
                {visibleMoreOfWhatYouLike.map((track) => (
                  <button
                    key={`more-${track.id}`}
                    type="button"
                    onClick={() => void playWithSmartQueue(track)}
                    className="w-40 shrink-0 overflow-hidden rounded-lg bg-dark-card text-left transition-all hover:bg-dark-border group"
                  >
                    <div className="relative overflow-hidden h-40">
                      <img 
                        src={track.imageUrl} 
                        alt={track.title} 
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
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

          {basedOnRecentListening.length > 0 && (
            <section className="mb-12 min-w-0 max-w-full">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Based on your recent listening</h2>
                {basedOnRecentListening.length > 8 && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded('basedOnRecent')}
                    className="text-sm font-semibold text-gray-400 transition-colors hover:text-white"
                  >
                    Show all
                  </button>
                )}
              </div>
              <HorizontalScroller>
                {visibleBasedOnRecent.map((track) => (
                  <button
                    key={`based-${track.id}`}
                    type="button"
                    onClick={() => void playWithSmartQueue(track)}
                    className="w-40 shrink-0 overflow-hidden rounded-lg bg-dark-card text-left transition-all hover:bg-dark-border group"
                  >
                    <div className="relative overflow-hidden h-40">
                      <img 
                        src={track.imageUrl} 
                        alt={track.title} 
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
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

          <section className="mb-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Today's biggest hits</h2>
              {todaysBiggestHits.length > 8 && (
                <button
                  type="button"
                  onClick={() => toggleExpanded('hits')}
                  className="text-sm font-semibold text-gray-400 transition-colors hover:text-white"
                >
                  Show all
                </button>
              )}
            </div>
            {loading && todaysBiggestHits.length === 0 ? (
              <p className="text-sm text-gray-400">Loading today's biggest hits...</p>
            ) : (
              <HorizontalScroller>
                {visibleHits.map((track) => (
                  <button
                    key={`hit-${track.id}`}
                    type="button"
                    onClick={() => void playWithSmartQueue(track)}
                    className="w-40 shrink-0 overflow-hidden rounded-lg bg-dark-card text-left transition-all hover:bg-dark-border group"
                  >
                    <div className="relative overflow-hidden h-40">
                      <img 
                        src={track.imageUrl} 
                        alt={track.title} 
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-white text-sm line-clamp-2">{track.title}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{track.artist}</p>
                    </div>
                  </button>
                ))}
              </HorizontalScroller>
            )}
          </section>
        </>
      )}
    </div>
  );
    </div>
  );
};
