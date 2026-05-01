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
    request<{ track: Track | null; error?: string; debug?: unknown }>('/resolve-youtube-track', {
      method: 'POST',
      body: JSON.stringify({ title, artist }),
    }),
  saveManualYouTubeSource: (track: Pick<Track, 'title' | 'artist' | 'album' | 'duration' | 'imageUrl'>, youtubeUrl: string) =>
    request<{ track: Track }>('/track-overrides/manual-youtube', {
      method: 'POST',
      body: JSON.stringify({
        ...track,
        youtubeUrl,
      }),
    }),

  getPlaylists: (userId?: string) => {
    const url = userId ? `/playlists?userId=${encodeURIComponent(userId)}` : '/playlists';
    return request<{ playlists: Playlist[] }>(url);
  },
  createPlaylist: (payload: { name: string; description?: string; imageUrl?: string; userId?: string }) =>
    request<{ playlist: Playlist }>('/playlists', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePlaylist: (
    playlistId: string,
    payload: Partial<Pick<Playlist, 'name' | 'description' | 'imageUrl'>>,
    userId?: string
  ) =>
    request<{ playlist: Playlist }>(`/playlists/${playlistId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...payload, userId }),
    }),
  deletePlaylist: (playlistId: string, userId?: string) =>
    request<void>(`/playlists/${playlistId}`, {
      method: 'DELETE',
      body: JSON.stringify({ userId }),
    }),
  addTrackToPlaylist: (playlistId: string, track: Track, userId?: string) =>
    request<{ playlist: Playlist }>(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ track, userId }),
    }),
  removeTrackFromPlaylist: (playlistId: string, trackId: string, userId?: string) =>
    request<{ playlist: Playlist }>(`/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE',
      body: JSON.stringify({ userId }),
    }),

  getLyrics: (artist: string, title: string) =>
    request<{ lyrics: string }>(
      `/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`
    ),
};
