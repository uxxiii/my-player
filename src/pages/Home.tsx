import React, { useEffect, useMemo, useState } from 'react';
import { Disc3, Heart, Radio, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMusic } from '../context/MusicContext';
import type { Track } from '../types';
import { api } from '../lib/api';
import { buildSmartQueue, loadPersonalizedRecommendations } from '../lib/discovery';

type HomeFilter = 'all' | 'music' | 'playlists' | 'podcasts';

const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  accentIcon?: React.ReactNode;
  onShowAll?: () => void;
  showAllLabel?: string;
}> = ({ title, subtitle, accentIcon, onShowAll, showAllLabel = 'Show all' }) => (
  <div className="mb-6 flex items-center justify-between gap-4">
    <div className="flex items-start gap-3">
      {accentIcon}
      <div>
        <h2 className="text-3xl font-bold text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
      </div>
    </div>
    {onShowAll && (
      <button
        type="button"
        onClick={onShowAll}
        className="text-sm font-semibold text-gray-400 transition-colors hover:text-white whitespace-nowrap"
      >
        {showAllLabel}
      </button>
    )}
  </div>
);

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

      {showMusicSections && (
        <>
          <section className="mb-16 min-w-0 max-w-full">
            <SectionHeader
              title="It's New Music Friday!"
              subtitle="Fresh tracks from your favorite artists"
              accentIcon={<Sparkles size={28} className="text-yellow-400 mt-1" />}
              onShowAll={() => toggleExpanded('jumpBackIn')}
            />
            <HorizontalScroller>
              {visibleJumpBackIn.map((track) => (
                <button
                  key={`jump-${track.id}`}
                  type="button"
                  onClick={() => void playWithSmartQueue(track)}
                  className="w-48 shrink-0 overflow-hidden rounded-lg bg-dark-card/60 backdrop-blur-sm border border-dark-border/50 text-left transition-all hover:bg-dark-card hover:border-dark-border group"
                >
                  <div className="relative overflow-hidden bg-dark-border">
                    <img 
                      src={track.imageUrl} 
                      alt={track.title} 
                      className="h-48 w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-white line-clamp-2">{track.title}</p>
                    <p className="text-sm text-gray-400 mt-2 line-clamp-1">{track.artist}</p>
                  </div>
                </button>
              ))}
            </HorizontalScroller>
          </section>

          <section className="mb-16 min-w-0 max-w-full">
            <SectionHeader
              title="Albums Featuring Songs You Like"
              accentIcon={<Heart size={28} className="text-red-400 mt-1" />}
              onShowAll={() => toggleExpanded('albums')}
            />
            <HorizontalScroller>
              {visibleAlbumsYouLike.map((track) => (
                <button
                  key={`album-${track.id}`}
                  type="button"
                  onClick={() => void playWithSmartQueue(track)}
                  className="w-48 shrink-0 overflow-hidden rounded-lg bg-dark-card/60 backdrop-blur-sm border border-dark-border/50 text-left transition-all hover:bg-dark-card hover:border-dark-border group"
                >
                  <div className="relative overflow-hidden bg-dark-border">
                    <img 
                      src={track.imageUrl} 
                      alt={track.album} 
                      className="h-48 w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-white line-clamp-2">{track.album}</p>
                    <p className="text-sm text-gray-400 mt-2 line-clamp-1">{track.artist}</p>
                  </div>
                </button>
              ))}
            </HorizontalScroller>
          </section>

          <section className="mb-16 min-w-0 max-w-full">
            <SectionHeader
              title="Recently Played"
              accentIcon={<Radio size={28} className="text-purple-400 mt-1" />}
              onShowAll={() => toggleExpanded('recents')}
            />
            <HorizontalScroller>
              {visibleRecents.map((track) => (
                <button
                  key={`recent-${track.id}`}
                  type="button"
                  onClick={() => void playWithSmartQueue(track)}
                  className="w-48 shrink-0 overflow-hidden rounded-lg bg-dark-card/60 backdrop-blur-sm border border-dark-border/50 text-left transition-all hover:bg-dark-card hover:border-dark-border group"
                >
                  <div className="relative overflow-hidden bg-dark-border">
                    <img 
                      src={track.imageUrl} 
                      alt={track.title} 
                      className="h-48 w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-white line-clamp-2">{track.title}</p>
                    <p className="text-sm text-gray-400 mt-2 line-clamp-1">{track.artist}</p>
                  </div>
                </button>
              ))}
            </HorizontalScroller>
          </section>

          <section className="mb-16 min-w-0 max-w-full">
            <SectionHeader
              title="Your Top Artists"
              accentIcon={<Sparkles size={28} className="text-cyan-400 mt-1" />}
              onShowAll={() => toggleExpanded('topArtists')}
            />
            <HorizontalScroller>
              {visibleTopArtists.map((artist, index) => (
                <div
                  key={artist.artist}
                  className="relative w-48 shrink-0 rounded-lg overflow-hidden bg-dark-card/60 backdrop-blur-sm border border-dark-border/50 hover:bg-dark-card hover:border-dark-border transition-all group"
                >
                  <div className="relative overflow-hidden h-48">
                    <img 
                      src={artist.imageUrl} 
                      alt={artist.artist} 
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                      <div className="text-6xl font-black text-white/90 drop-shadow-lg leading-none">
                        {index + 1}
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-white line-clamp-2">{artist.artist}</p>
                  </div>
                </div>
              ))}
            </HorizontalScroller>
          </section>

          <section className="mb-16 min-w-0 max-w-full">
            <SectionHeader
              title="More Of What You Like"
              accentIcon={<Sparkles size={28} className="text-green-400 mt-1" />}
              onShowAll={() => toggleExpanded('moreLike')}
            />
            <HorizontalScroller>
              {visibleMoreOfWhatYouLike.map((track) => (
                <button
                  key={`more-${track.id}`}
                  type="button"
                  onClick={() => void playWithSmartQueue(track)}
                  className="w-48 shrink-0 overflow-hidden rounded-lg bg-dark-card/60 backdrop-blur-sm border border-dark-border/50 text-left transition-all hover:bg-dark-card hover:border-dark-border group"
                >
                  <div className="relative overflow-hidden bg-dark-border">
                    <img 
                      src={track.imageUrl} 
                      alt={track.title} 
                      className="h-48 w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-white line-clamp-2">{track.title}</p>
                    <p className="text-sm text-gray-400 mt-2 line-clamp-1">{track.artist}</p>
                  </div>
                </button>
              ))}
            </HorizontalScroller>
          </section>

          <section className="mb-16 min-w-0 max-w-full">
            <SectionHeader
              title="Based On Your Recent Listening"
              accentIcon={<Radio size={28} className="text-orange-400 mt-1" />}
              onShowAll={() => toggleExpanded('basedOnRecent')}
            />
            <HorizontalScroller>
              {visibleBasedOnRecent.map((track) => (
                <button
                  key={`based-${track.id}`}
                  type="button"
                  onClick={() => void playWithSmartQueue(track)}
                  className="w-48 shrink-0 overflow-hidden rounded-lg bg-dark-card/60 backdrop-blur-sm border border-dark-border/50 text-left transition-all hover:bg-dark-card hover:border-dark-border group"
                >
                  <div className="relative overflow-hidden bg-dark-border">
                    <img 
                      src={track.imageUrl} 
                      alt={track.title} 
                      className="h-48 w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-white line-clamp-2">{track.title}</p>
                    <p className="text-sm text-gray-400 mt-2 line-clamp-1">{track.artist}</p>
                  </div>
                </button>
              ))}
            </HorizontalScroller>
          </section>

          <section className="mb-12">
            <SectionHeader
              title="Today's Biggest Hits"
              accentIcon={<Disc3 size={28} className="text-pink-400 mt-1" />}
              onShowAll={() => toggleExpanded('hits')}
            />
            {loading && todaysBiggestHits.length === 0 ? (
              <p className="text-sm text-gray-400">Loading today's biggest hits...</p>
            ) : (
              <HorizontalScroller>
                {visibleHits.map((track) => (
                  <button
                    key={`hit-${track.id}`}
                    type="button"
                    onClick={() => void playWithSmartQueue(track)}
                    className="w-48 shrink-0 overflow-hidden rounded-lg bg-dark-card/60 backdrop-blur-sm border border-dark-border/50 text-left transition-all hover:bg-dark-card hover:border-dark-border group"
                  >
                    <div className="relative overflow-hidden bg-dark-border">
                      <img 
                        src={track.imageUrl} 
                        alt={track.title} 
                        className="h-48 w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    </div>
                    <div className="p-4">
                      <p className="font-bold text-white line-clamp-2">{track.title}</p>
                      <p className="text-sm text-gray-400 mt-2 line-clamp-1">{track.artist}</p>
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
};
