import React from 'react';
import { Play, Heart, Plus } from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import type { Track } from '../types';
import { buildContextualQueue } from '../lib/discovery';

export const LikedSongs: React.FC = () => {
  const { likedTracks, playTrack, setQueue, toggleLikeTrack, playlists, addTrackToPlaylist, recentScrobbles } = useMusic();

  return (
    <div className="main-content p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Liked Songs</h1>
        <p className="text-gray-400">Your favorite tracks are saved here for quick access.</p>
      </div>

      {likedTracks.length ? (
        <div className="space-y-2">
          {likedTracks.map((track: Track) => (
            <div
              key={track.id}
              className="group bg-dark-card border border-dark-border rounded-lg p-4 hover:bg-dark-border transition-colors flex items-center gap-4"
            >
              <img src={track.imageUrl} alt={track.title} className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">{track.title}</h3>
                <p className="text-sm text-gray-400 truncate">{track.artist}</p>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    void (async () => {
                      const queue = await buildContextualQueue({
                        focusedTrack: track,
                        contextTracks: likedTracks,
                        recentScrobbles,
                        likedTracks,
                      });
                      setQueue(queue);
                      playTrack(track);
                    })();
                  }}
                  className="p-2 rounded-lg bg-blue-primary hover:bg-blue-secondary text-white transition-colors"
                >
                  <Play size={16} fill="currentColor" />
                </button>
                <button
                  onClick={() => toggleLikeTrack(track)}
                  className="p-2 rounded-lg text-red-400 hover:text-red-500 transition-colors"
                >
                  <Heart size={16} fill="currentColor" />
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
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No liked songs yet.</p>
          <p className="text-sm text-gray-500 mt-2">Like a track from search or trending to save it here.</p>
        </div>
      )}
    </div>
  );
};
