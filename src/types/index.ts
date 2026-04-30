export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  imageUrl: string;
  audioUrl?: string;
  preview_url?: string;
  youtubeVideoId?: string;
  playbackType?: 'preview' | 'youtube' | 'full_audio';
  sourceLabel?: string;
}

export interface ScrobbleEntry {
  id: string;
  playedAt: string;
  track: Track;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: Track[];
  imageUrl?: string;
  createdAt: Date | string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  profileImage?: string;
  playlists: Playlist[];
  likedTracks: Track[];
  provider?: 'google' | 'local';
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  queue: Track[];
  currentIndex: number;
  playbackMode: 'audio' | 'youtube' | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token?: string;
}
