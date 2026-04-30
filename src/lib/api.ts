import type { Playlist, Track } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

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
  getSpotifyAuthUrl: (redirectUri: string) =>
    request<{ authUrl: string }>(`/spotify/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`),
  exchangeSpotifyCode: (code: string, redirectUri: string) =>
    request<{
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token?: string;
      scope: string;
    }>('/spotify/token', {
      method: 'POST',
      body: JSON.stringify({ code, redirectUri }),
    }),
  getSpotifyPlaylists: (accessToken: string) =>
    request<{ playlists: Array<{ id: string; name: string; imageUrl?: string; tracksCount: number }> }>(
      '/spotify/playlists',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    ),
  getSpotifyPlaylistTracks: (accessToken: string, playlistId: string) =>
    request<{ tracks: Track[] }>(`/spotify/playlists/${playlistId}/tracks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
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
