import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ellipsis, Heart, Music2, Play, Search, Trash2 } from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { buildContextualQueue, loadPlaylistRecommendations } from '../lib/discovery';
import type { Track } from '../types';

export const Playlist: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    playlists,
    playTrack,
    setQueue,
    removeTrackFromPlaylist,
    likedTracks,
    recentScrobbles,
    toggleLikeTrack,
    updatePlaylist,
    addTrackToPlaylist,
    deletePlaylist,
  } = useMusic();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const playlist = playlists.find((item) => item.id === id);

  useEffect(() => {
    const loadRecommendations = async () => {
      if (!playlist) return;

      try {
        const tracks = await loadPlaylistRecommendations({
          playlistTracks: playlist.tracks,
          fallbackArtist: playlist.tracks[0]?.artist,
        });
        setRecommendedTracks(tracks.slice(0, 8));
      } catch (error) {
        console.error('Failed to load playlist recommendations:', error);
        setRecommendedTracks([]);
      }
    };

    void loadRecommendations();
  }, [playlist]);

  const handleSearch = async (value: string) => {
    setSearchQuery(value);

    if (!value.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await import('../lib/api').then(({ api }) => api.searchTracks(value));
      setSearchResults(response.tracks);
    } catch (error) {
      console.error('Playlist search failed:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  if (!playlist) {
    return (
      <div className="main-content p-6">
        <div className="py-12 text-center">
          <p className="text-lg text-gray-400">Playlist not found</p>
        </div>
      </div>
    );
  }

  const handlePlayAll = () => {
    if (playlist.tracks.length === 0) return;

    void (async () => {
      const queue = await buildContextualQueue({
        focusedTrack: playlist.tracks[0],
        contextTracks: playlist.tracks,
                        recentScrobbles,
        likedTracks,
      });
      setQueue(queue);
      playTrack(playlist.tracks[0]);
    })();
  };

  const handleDeletePlaylist = async () => {
    await deletePlaylist(playlist.id);
    navigate('/');
  };

  return (
    <div className="main-content p-6">
      <div className="mb-8">
        <div className="mb-6 flex items-end gap-6">
          {playlist.imageUrl ? (
            <img src={playlist.imageUrl} alt={playlist.name} className="h-28 w-28 rounded-2xl object-cover md:h-32 md:w-32" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-primary to-blue-secondary md:h-32 md:w-32">
              <Music2 size={52} className="text-white/90" />
            </div>
          )}

          <div className="flex-1">
            {editingName ? (
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  className="rounded-lg border border-blue-primary bg-dark-card px-4 py-2 text-white"
                  autoFocus
                />
                <button
                  onClick={async () => {
                    if (newName.trim()) {
                      await updatePlaylist(playlist.id, { name: newName.trim() });
                    }
                    setEditingName(false);
                  }}
                  className="rounded-lg bg-blue-primary px-4 py-2 text-white transition-colors hover:bg-blue-secondary"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="rounded-lg bg-dark-card px-4 py-2 text-white transition-colors hover:bg-dark-border"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div
                onClick={() => {
                  setEditingName(true);
                  setNewName(playlist.name);
                }}
                className="mb-4 cursor-pointer"
              >
                <h1 className="text-5xl font-bold text-white transition-colors hover:text-blue-primary">
                  {playlist.name}
                </h1>
              </div>
            )}
            <p className="text-gray-400">{playlist.tracks.length} songs</p>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-dark-card text-gray-300 transition-colors hover:bg-dark-border hover:text-white"
            >
              <Ellipsis size={18} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-14 z-20 w-44 overflow-hidden rounded-xl border border-dark-border bg-dark-card shadow-xl">
                <button
                  type="button"
                  onClick={() => void handleDeletePlaylist()}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-400 transition-colors hover:bg-dark-border"
                >
                  <Trash2 size={16} />
                  <span>Delete playlist</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-2 rounded-lg bg-blue-primary px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-secondary"
          >
            <Play size={18} fill="currentColor" />
            Play All
          </button>
        </div>
      </div>

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <Music2 size={18} className="text-blue-primary" />
          <h2 className="text-2xl font-bold text-white">Songs in this playlist</h2>
        </div>

        {playlist.tracks.length > 0 ? (
          <div className="space-y-2">
            {playlist.tracks.map((track, index) => (
              <div
                key={track.id}
                className="group flex items-center gap-4 rounded-lg border border-dark-border bg-dark-card p-4 transition-colors hover:bg-dark-border"
              >
                <span className="w-8 text-right text-gray-400">{index + 1}</span>
                <img src={track.imageUrl} alt={track.title} className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-white">{track.title}</h3>
                  <p className="truncate text-sm text-gray-400">{track.artist}</p>
                </div>
                <div className="w-20 text-right text-sm text-gray-400">
                  {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}
                </div>
                <div className="flex items-center gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <button
                    onClick={() => {
                      void (async () => {
                        const queue = await buildContextualQueue({
                          focusedTrack: track,
                          contextTracks: playlist.tracks,
                          recentScrobbles,
                          likedTracks,
                        });
                        setQueue(queue);
                        playTrack(track);
                      })();
                    }}
                    className="rounded-lg bg-blue-primary p-2 text-white transition-colors hover:bg-blue-secondary"
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                  <button
                    onClick={() => toggleLikeTrack(track)}
                    className={`rounded-lg p-2 transition-colors ${
                      likedTracks.some((item) => item.id === track.id)
                        ? 'bg-red-500/10 text-red-500'
                        : 'text-gray-400 hover:text-red-400'
                    }`}
                  >
                    <Heart
                      size={16}
                      fill={likedTracks.some((item) => item.id === track.id) ? 'currentColor' : 'none'}
                    />
                  </button>
                  <button
                    onClick={() => {
                      void removeTrackFromPlaylist(playlist.id, track.id);
                    }}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-dark-border bg-dark-card/70 px-5 py-10 text-center text-gray-400">
            Start adding songs to shape this playlist.
          </div>
        )}
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <Search size={18} className="text-blue-primary" />
          <h2 className="text-2xl font-bold text-white">Add more songs</h2>
        </div>
        <div className="max-w-2xl">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-3 text-gray-500" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => void handleSearch(event.target.value)}
              placeholder={`Search songs to add to ${playlist.name}...`}
              className="w-full rounded-xl border border-dark-border bg-dark-card py-3 pl-10 pr-4 text-white outline-none transition-colors focus:border-blue-primary"
            />
          </div>

          {searchLoading && <p className="text-sm text-gray-400">Searching tracks...</p>}

          {searchResults.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-card">
              {searchResults.slice(0, 6).map((track) => {
                const alreadyInPlaylist = playlist.tracks.some((item) => item.id === track.id);

                return (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 border-b border-dark-border px-4 py-3 last:border-b-0"
                  >
                    <img src={track.imageUrl} alt={track.title} className="h-10 w-10 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                      <p className="truncate text-xs text-gray-400">{track.artist}</p>
                    </div>
                    <button
                      type="button"
                      disabled={alreadyInPlaylist}
                      onClick={() => {
                        void addTrackToPlaylist(playlist.id, track);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        alreadyInPlaylist
                          ? 'bg-white/5 text-gray-500'
                          : 'bg-blue-primary/15 text-blue-100 hover:bg-blue-primary hover:text-white'
                      }`}
                    >
                      {alreadyInPlaylist ? 'Added' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          <Play size={18} className="text-blue-primary" />
          <h2 className="text-2xl font-bold text-white">Recommended for this playlist</h2>
        </div>

        {recommendedTracks.length > 0 ? (
          <div className="space-y-2">
            {recommendedTracks.map((track) => (
              <div
                key={`rec-${track.id}`}
                className="flex items-center gap-4 rounded-lg border border-dark-border bg-dark-card p-4 transition-colors hover:bg-dark-border"
              >
                <img src={track.imageUrl} alt={track.title} className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-white">{track.title}</h3>
                  <p className="truncate text-sm text-gray-400">{track.artist}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void addTrackToPlaylist(playlist.id, track);
                  }}
                  className="rounded-lg bg-blue-primary/15 px-3 py-2 text-sm font-semibold text-blue-100 transition-colors hover:bg-blue-primary hover:text-white"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-dark-border bg-dark-card/70 px-5 py-10 text-center text-gray-400">
            Add a few songs and recommendations will start to appear here.
          </div>
        )}
      </section>
    </div>
  );
};
