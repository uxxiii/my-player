import React, { useState } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search as SearchIcon, Play, Heart, Plus } from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import type { Track } from '../types';
import { api } from '../lib/api';
import { buildSmartQueue } from '../lib/discovery';

export const Search: React.FC = () => {
  const location = useLocation();
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const { playTrack, setQueue, likedTracks, toggleLikeTrack, addTrackToPlaylist, playlists, recentScrobbles } = useMusic();
  const searchQuery = new URLSearchParams(location.search).get('q') ?? '';

  const playWithSmartQueue = async (track: Track) => {
    const queue = await buildSmartQueue({
      focusedTrack: track,
      recentScrobbles,
      likedTracks,
      excludedTrackIds: searchResults.map((item) => item.id),
    });

    setQueue(queue);
    playTrack(track);
  };

  const runSearch = async (query: string) => {
    setHasSearched(true);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const { tracks } = await api.searchTracks(query);
      setSearchResults(tracks);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Route-driven search needs to update results when the URL changes.
    if (searchQuery.trim()) {
      void runSearch(searchQuery);
    } else {
      setHasSearched(false);
      setSearchResults([]);
    }
  }, [searchQuery]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="main-content p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Search Results</h1>
        <p className="text-gray-400">
          {searchQuery ? `Showing matches for "${searchQuery}"` : 'Use the top search bar to find tracks'}
        </p>
      </div>

      {/* Search Results */}
      {hasSearched ? (
        <>
          {loading && <p className="text-gray-400 mb-4">Searching real catalog...</p>}
          {searchResults.length > 0 ? (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">
                Results for "{searchQuery}" ({searchResults.length})
              </h2>
              <div className="space-y-2">
                {searchResults.map((track) => (
                  <div
                    key={track.id}
                    className="group bg-dark-card border border-dark-border rounded-lg p-4 hover:bg-dark-border transition-colors flex items-center gap-4"
                  >
                    <img
                      src={track.imageUrl}
                      alt={track.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">{track.title}</h3>
                      <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                    </div>
                    <div className="text-sm text-gray-400">{track.album}</div>
                    <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => void playWithSmartQueue(track)}
                        className="p-2 rounded-lg bg-blue-primary hover:bg-blue-secondary text-white transition-colors"
                      >
                        <Play size={16} fill="currentColor" />
                      </button>
                      <button
                        onClick={() => toggleLikeTrack(track)}
                        className={`p-2 rounded-lg transition-colors ${
                          likedTracks.some((item) => item.id === track.id)
                            ? 'text-red-500 bg-red-500/10'
                            : 'text-gray-400 hover:text-red-400'
                        }`}
                      >
                        <Heart size={16} fill={likedTracks.some((item) => item.id === track.id) ? 'currentColor' : 'none'} />
                      </button>
                      <div className="relative group/menu">
                        <button className="p-2 rounded-lg text-gray-400 hover:text-blue-primary transition-colors">
                          <Plus size={16} />
                        </button>
                        {playlists.length > 0 && (
                          <div className="absolute right-0 mt-1 w-48 bg-dark-card border border-dark-border rounded-lg shadow-lg opacity-0 group-hover/menu:opacity-100 pointer-events-none group-hover/menu:pointer-events-auto transition-opacity z-10">
                            {playlists.map((playlist) => (
                              <button
                                key={playlist.id}
                                onClick={() => {
                                  void addTrackToPlaylist(playlist.id, track);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-dark-border transition-colors first:rounded-t-lg last:rounded-b-lg"
                              >
                                {playlist.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <SearchIcon size={48} className="mx-auto text-gray-500 mb-4" />
              <p className="text-gray-400">No results found for "{searchQuery}"</p>
              <p className="text-sm text-gray-500 mt-2">Try searching for different keywords</p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <SearchIcon size={48} className="mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400">Start typing to search for music</p>
        </div>
      )}
    </div>
  );
};
