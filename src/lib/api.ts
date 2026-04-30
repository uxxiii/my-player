import type { Playlist, Track } from '../types';

// Hardcoded for production - will be replaced with env var in build
export const API_BASE = import.meta.env.VITE_API_BASE || 'https://my-player-tj2q.onrender.com/api';

console.log('🎵 API_BASE resolved to:', API_BASE);

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

export const api = {
  health: () => request<{ ok: boolean }>('/health'),
  getTrendingTracks: () => request<{ tracks: Track[] }>('/tracks/trending'),
  searchTracks: (q: string) => request<{ tracks: Track[] }>(`/search?q=${encodeURIComponent(q)}`),
  getRecommendations: (artist: string) =>
    request<{ tracks: Track[] }>(`/recommendations?artist=${encodeURIComponent(artist)}`),
  getRelatedRecommendations: (payload: {
    artist?: string;
    title?: string;
    album?: string;
    seedArtists?: string[];
    seedTitles?: string[];
    excludeTrackIds?: string[];
  }) =>
    request<{ tracks: Track[] }>('/recommendations/related', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resolveYouTubeTrack: (title: string, artist: string) =>
    request<{ track: Track | null }>('/resolve-youtube-track', {
      method: 'POST',
      body: JSON.stringify({ title, artist }),
    }),

  getPlaylists: () => request<{ playlists: Playlist[] }>('/playlists'),
  createPlaylist: (payload: { name: string; description?: string; imageUrl?: string }) =>
    request<{ playlist: Playlist }>('/playlists', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePlaylist: (
    playlistId: string,
    payload: Partial<Pick<Playlist, 'name' | 'description' | 'imageUrl'>>
  ) =>
    request<{ playlist: Playlist }>(`/playlists/${playlistId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deletePlaylist: (playlistId: string) =>
    request<void>(`/playlists/${playlistId}`, {
      method: 'DELETE',
    }),
  addTrackToPlaylist: (playlistId: string, track: Track) =>
    request<{ playlist: Playlist }>(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ track }),
    }),
  removeTrackFromPlaylist: (playlistId: string, trackId: string) =>
    request<{ playlist: Playlist }>(`/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE',
    }),

  getLyrics: (artist: string, title: string) =>
    request<{ lyrics: string }>(
      `/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`
    ),
};
