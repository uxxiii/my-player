import React from 'react';
import { Heart, ListMusic, Music, PanelLeft, Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useMusic } from '../context/MusicContext';

interface NavigationProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenCreatePlaylist?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  isCollapsed = false,
  onToggleCollapse,
  onOpenCreatePlaylist,
}) => {
  const { playlists } = useMusic();
  const railItemClassName = 'h-12 w-12 rounded-[0.95rem]';
  const coverClassName = isCollapsed ? 'h-full w-full rounded-[0.72rem] object-cover' : 'h-10 w-10 rounded-[0.72rem] object-cover';

  return (
    <div className="sidebar">
      <div className={`border-b border-dark-border ${isCollapsed ? 'px-3 py-4' : 'p-5'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between gap-3'}`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-blue-primary/15 text-blue-primary">
              <Music size={24} />
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="text-2xl font-bold text-blue-primary">MyPlayer</h1>
                <p className="text-xs text-gray-500">Your collection</p>
              </div>
            )}
          </div>

          {onToggleCollapse && !isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden h-10 w-10 items-center justify-center rounded-[0.8rem] border border-white/10 text-gray-400 transition-colors hover:border-white/20 hover:bg-dark-border hover:text-white md:inline-flex"
              title="Collapse library"
            >
              <PanelLeft size={16} />
            </button>
          )}
        </div>

        {onToggleCollapse && isCollapsed && (
          <div className="mt-3 hidden justify-center md:flex">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-12 w-12 items-center justify-center rounded-[0.95rem] text-gray-400 transition-colors hover:bg-dark-border hover:text-white"
              title="Expand library"
            >
              <PanelLeft size={20} />
            </button>
          </div>
        )}
      </div>

      <div className={isCollapsed ? 'px-2 py-4' : 'px-4 py-4'}>
        <div className={`mb-4 flex items-center ${isCollapsed ? 'flex-col gap-3' : 'justify-between'}`}>
          {!isCollapsed && (
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
              <ListMusic size={16} />
              <span>My Library</span>
            </div>
          )}
          <button
            type="button"
            onClick={onOpenCreatePlaylist}
            className={`inline-flex items-center justify-center text-blue-primary transition-colors hover:bg-dark-border hover:text-white ${
              isCollapsed
                ? `${railItemClassName}`
                : 'h-10 w-10 rounded-[0.8rem] border border-white/10 bg-blue-primary/10 hover:border-white/20'
            }`}
            title="Create playlist"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className={`space-y-2 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          <NavLink
            to="/liked"
            title="Liked Songs"
            className={({ isActive }) =>
              `playlist-item flex items-center ${isCollapsed ? `${railItemClassName} justify-center p-0.5` : 'gap-3 text-sm text-gray-300'} ${
                isActive ? 'bg-dark-border text-blue-primary' : ''
              }`
            }
          >
            {isCollapsed ? (
              <Heart size={20} fill="currentColor" className="text-red-400" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-[0.72rem] bg-red-500/10 text-red-400">
                <Heart size={16} fill="currentColor" />
              </div>
            )}
            {!isCollapsed && <span className="truncate">Liked Songs</span>}
          </NavLink>

          {playlists.map((playlist) => (
            <NavLink
              key={playlist.id}
              to={`/playlist/${playlist.id}`}
              title={playlist.name}
              className={({ isActive }) =>
                `playlist-item flex items-center ${isCollapsed ? `${railItemClassName} justify-center p-0.5` : 'gap-3 text-sm text-gray-300'} ${
                  isActive ? 'bg-dark-border text-blue-primary' : ''
                }`
              }
            >
              {playlist.imageUrl ? (
                <img
                  src={playlist.imageUrl}
                  alt={playlist.name}
                  className={coverClassName}
                />
              ) : (
                <div className={`flex items-center justify-center text-blue-primary ${isCollapsed ? 'h-full w-full' : 'h-10 w-10 rounded-[0.72rem] bg-blue-primary/20'}`}>
                  <Music size={isCollapsed ? 20 : 16} />
                </div>
              )}
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{playlist.name}</p>
                  <p className="truncate text-xs text-gray-500">
                    {playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}
                  </p>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
};
