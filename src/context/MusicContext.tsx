import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { PlayerState, Playlist, ScrobbleEntry, Track, User } from '../types';
import { api, API_BASE } from '../lib/api';

const USER_STORAGE_KEY = 'myplayer_user';
const LIKED_TRACKS_STORAGE_KEY = 'myplayer_liked_tracks';
const RECENT_SCROBBLES_STORAGE_KEY = 'myplayer_recent_scrobbles';
const INITIAL_PLAYER_STATE: PlayerState = {
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 70,
  queue: [],
  currentIndex: 0,
  playbackMode: null,
};

interface MusicContextType {
  playerState: PlayerState;
  playTrack: (track: Track) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setQueue: (tracks: Track[]) => void;
  recentScrobbles: ScrobbleEntry[];
  registerYouTubeHost: (element: HTMLDivElement | null) => void;

  playlists: Playlist[];
  createPlaylist: (name: string, description?: string, imageUrl?: string) => Promise<Playlist>;
  updatePlaylist: (id: string, updates: Partial<Pick<Playlist, 'name' | 'description' | 'imageUrl'>>) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  saveManualYouTubeSource: (track: Track, youtubeUrl: string) => Promise<Track>;

  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;

  likedTracks: Track[];
  isTrackLiked: (trackId: string) => boolean;
  toggleLikeTrack: (track: Track) => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

const loadJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;

  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Failed to read ${key}:`, error);
    return fallback;
  }
};

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const youtubePlayerRef = useRef<YT.Player | null>(null);
  const youtubeHostRef = useRef<HTMLDivElement | null>(null);
  const youtubeScriptPromiseRef = useRef<Promise<void> | null>(null);
  const youtubeProgressTimerRef = useRef<number | null>(null);
  const startTrackRef = useRef<(track: Track, indexOverride?: number) => void>(() => undefined);
  const playerStateRef = useRef<PlayerState>(INITIAL_PLAYER_STATE);
  const lastScrobbledKeyRef = useRef<string | null>(null);

  const [playerState, setPlayerState] = useState<PlayerState>(INITIAL_PLAYER_STATE);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [user, setUser] = useState<User | null>(() => loadJson<User | null>(USER_STORAGE_KEY, null));
  const [likedTracks, setLikedTracks] = useState<Track[]>(() => loadJson<Track[]>(LIKED_TRACKS_STORAGE_KEY, []));
  const [recentScrobbles, setRecentScrobbles] = useState<ScrobbleEntry[]>(() =>
    loadJson<ScrobbleEntry[]>(RECENT_SCROBBLES_STORAGE_KEY, [])
  );

  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(RECENT_SCROBBLES_STORAGE_KEY, JSON.stringify(recentScrobbles));
    }
  }, [recentScrobbles]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      return;
    }

    localStorage.removeItem(USER_STORAGE_KEY);
  }, [user]);

  const updatePlayerState = useCallback((updater: (prev: PlayerState) => PlayerState) => {
    setPlayerState((prev) => {
      const next = updater(prev);
      playerStateRef.current = next;
      return next;
    });
  }, []);

  const pushScrobble = useCallback((track: Track) => {
    const key = `${track.id}:${track.title}:${track.artist}`;
    if (lastScrobbledKeyRef.current === key) return;

    lastScrobbledKeyRef.current = key;
    setRecentScrobbles((prev) => [
      {
        id: `${track.id}-${Date.now()}`,
        playedAt: new Date().toISOString(),
        track,
      },
      ...prev,
    ].slice(0, 10));
  }, []);

  const stopYouTubeProgressTimer = useCallback(() => {
    if (youtubeProgressTimerRef.current) {
      window.clearInterval(youtubeProgressTimerRef.current);
      youtubeProgressTimerRef.current = null;
    }
  }, []);

  const syncYouTubeProgress = useCallback(() => {
    if (!youtubePlayerRef.current) return;

    const currentTime = youtubePlayerRef.current.getCurrentTime() || 0;
    const duration = youtubePlayerRef.current.getDuration() || 0;

    updatePlayerState((prev) => ({
      ...prev,
      currentTime,
      duration: duration || prev.duration,
      playbackMode: 'youtube',
    }));
  }, [updatePlayerState]);

  const startYouTubeProgressTimer = useCallback(() => {
    stopYouTubeProgressTimer();
    youtubeProgressTimerRef.current = window.setInterval(() => {
      syncYouTubeProgress();
    }, 500);
  }, [stopYouTubeProgressTimer, syncYouTubeProgress]);

  const loadYouTubeApi = useCallback(() => {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.YT?.Player) return Promise.resolve();
    if (youtubeScriptPromiseRef.current) return youtubeScriptPromiseRef.current;

    youtubeScriptPromiseRef.current = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-youtube-iframe-api="true"]');
      const handleReady = () => resolve();

      window.onYouTubeIframeAPIReady = handleReady;

      if (existing) {
        existing.addEventListener('error', () => reject(new Error('Failed to load YouTube player API')), {
          once: true,
        });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.youtubeIframeApi = 'true';
      script.onerror = () => reject(new Error('Failed to load YouTube player API'));
      document.body.appendChild(script);
    });

    return youtubeScriptPromiseRef.current;
  }, []);

  const initializeYouTubePlayer = useCallback(async (): Promise<boolean> => {
    if (!youtubeHostRef.current) return false;
    if (youtubePlayerRef.current) return true;

    await loadYouTubeApi();
    if (!window.YT?.Player || !youtubeHostRef.current) return false;

    await new Promise<void>((resolve) => {
      youtubePlayerRef.current = new window.YT!.Player(youtubeHostRef.current!, {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(playerStateRef.current.volume);
            resolve();
          },
          onStateChange: (event) => {
            if (event.data === window.YT!.PlayerState.PLAYING) {
              startYouTubeProgressTimer();
              syncYouTubeProgress();
              updatePlayerState((prev) => ({
                ...prev,
                isPlaying: true,
                playbackMode: 'youtube',
              }));
              return;
            }

            if (event.data === window.YT!.PlayerState.PAUSED) {
              syncYouTubeProgress();
              stopYouTubeProgressTimer();
              updatePlayerState((prev) => ({
                ...prev,
                isPlaying: false,
                playbackMode: 'youtube',
              }));
              return;
            }

            if (event.data === window.YT!.PlayerState.ENDED) {
              stopYouTubeProgressTimer();
              const { queue, currentIndex } = playerStateRef.current;
              if (queue.length === 0) {
                updatePlayerState((prev) => ({
                  ...prev,
                  isPlaying: false,
                  currentTime: 0,
                }));
                return;
              }

              const nextIndex = (currentIndex + 1) % queue.length;
              startTrackRef.current(queue[nextIndex], nextIndex);
            }
          },
          onError: () => {
            stopYouTubeProgressTimer();
            updatePlayerState((prev) => ({
              ...prev,
              isPlaying: false,
            }));
          },
        },
      });
    });

    return true;
  }, [loadYouTubeApi, startYouTubeProgressTimer, stopYouTubeProgressTimer, syncYouTubeProgress, updatePlayerState]);

  const registerYouTubeHost = useCallback((element: HTMLDivElement | null) => {
    youtubeHostRef.current = element;
  }, []);

  const pausePreviewAudio = useCallback(() => {
    audioRef.current.pause();
  }, []);

  const cacheResolvedTrack = useCallback(
    (track: Track) => {
      updatePlayerState((prev) => ({
        ...prev,
        currentTrack: prev.currentTrack?.id === track.id ? { ...prev.currentTrack, ...track } : prev.currentTrack,
        queue: prev.queue.map((item) => (item.id === track.id ? { ...item, ...track } : item)),
      }));

      setLikedTracks((prev) => {
        const next = prev.map((item) => (item.id === track.id ? { ...item, ...track } : item));
        if (typeof window !== 'undefined') {
          localStorage.setItem(LIKED_TRACKS_STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });

      setPlaylists((prev) =>
        prev.map((playlist) => ({
          ...playlist,
          tracks: playlist.tracks.map((item) => (item.id === track.id ? { ...item, ...track } : item)),
        }))
      );
    },
    [updatePlayerState]
  );

  const resolveTrackForPlayback = useCallback(
    async (track: Track) => {
      if (track.youtubeVideoId || (track.playbackType === 'full_audio' && !!track.audioUrl)) {
        console.log('🎵 Track already has YouTube ID:', track.youtubeVideoId);
        return track;
      }

      console.log('🎵 Resolving YouTube ID for:', track.title, 'by', track.artist);
      try {
        const response = await api.resolveYouTubeTrack(track.title, track.artist);
        console.log('🎵 YouTube API response:', response);
        const resolvedYouTubeTrack = response.track;

        if (!resolvedYouTubeTrack) {
          console.warn('🎵 No YouTube ID found, backend error:', response.error ?? 'none');
          if (response.debug) {
            console.warn('YouTube resolve debug:', response.debug);
          }
          return track;
        }

        const mergedTrack: Track = {
          ...track,
          ...resolvedYouTubeTrack,
          id: track.id,
          imageUrl: track.imageUrl || resolvedYouTubeTrack.imageUrl,
          album: resolvedYouTubeTrack.album || track.album,
          duration: resolvedYouTubeTrack.duration || track.duration,
        };

        cacheResolvedTrack(mergedTrack);
        console.log('🎵 Successfully resolved YouTube ID:', resolvedYouTubeTrack.youtubeVideoId);
        return mergedTrack;
      } catch (error) {
        console.error('❌ Failed to resolve YouTube track for playback:', error);
        return track;
      }
    },
    [cacheResolvedTrack]
  );

  const startYouTubeTrack = useCallback(
    async (track: Track, indexOverride?: number) => {
      if (!track.youtubeVideoId) return false;

      const ready = await initializeYouTubePlayer();
      if (!ready || !youtubePlayerRef.current) {
        return false;
      }

      try {
        pausePreviewAudio();
        youtubePlayerRef.current.loadVideoById(track.youtubeVideoId);

        updatePlayerState((prev) => {
          const queueIndex = prev.queue.findIndex(
            (item) => (item.youtubeVideoId ?? item.id) === track.youtubeVideoId
          );

          return {
            ...prev,
            currentTrack: track,
            isPlaying: true,
            currentTime: 0,
            duration: track.duration || prev.duration,
            currentIndex: indexOverride ?? (queueIndex >= 0 ? queueIndex : prev.currentIndex),
            playbackMode: 'youtube',
          };
        });

        pushScrobble(track);
        return true;
      } catch (error) {
        console.error('YouTube playback failed:', error);
        return false;
      }
    },
    [initializeYouTubePlayer, pausePreviewAudio, pushScrobble, updatePlayerState]
  );

  const normalizeAudioSource = (source?: string, fallback?: string): string | undefined => {
    if (!source) return fallback;

    // Avoid stale local development proxy URLs from old cached tracks.
    if (source.startsWith('http://localhost:4000')) {
      console.warn('⚠️ Rewriting stale localhost audio source to fallback preview URL:', source);
      return fallback ?? source.replace(/^http:\/\/localhost:4000/, API_BASE);
    }

    // Use HTTPS on deployed hosts if the source was accidentally generated with HTTP.
    if (source.startsWith('http://') && source.includes('/api/audio')) {
      return source.replace(/^http:\/\//, 'https://');
    }

    return source;
  };

  const startAudioTrack = useCallback(
    (track: Track, indexOverride?: number) => {
      const audio = audioRef.current;
      const source = normalizeAudioSource(track.audioUrl, track.preview_url) ?? track.preview_url;

      if (!source) {
        updatePlayerState((prev) => {
          const queueIndex = prev.queue.findIndex((item) => item.id === track.id);
          return {
            ...prev,
            currentTrack: track,
            isPlaying: false,
            currentTime: 0,
            duration: track.duration,
            currentIndex: indexOverride ?? (queueIndex >= 0 ? queueIndex : prev.currentIndex),
            playbackMode: null,
          };
        });
        return false;
      }

      if (youtubePlayerRef.current) {
        youtubePlayerRef.current.pauseVideo();
      }

      audio.pause();
      audio.src = '';
      audio.currentTime = 0;
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.src = source;
      audio.load();
      audio.play().catch((error) => console.error('Play error:', error));
      pushScrobble(track);

      updatePlayerState((prev) => {
        const queueIndex = prev.queue.findIndex((item) => item.id === track.id);
        return {
          ...prev,
          currentTrack: track,
          isPlaying: true,
          currentTime: 0,
          duration: track.duration,
          currentIndex: indexOverride ?? (queueIndex >= 0 ? queueIndex : prev.currentIndex),
          playbackMode: 'audio',
        };
      });

      return true;
    },
    [pushScrobble, updatePlayerState]
  );

  const startTrack = useCallback(
    (track: Track, indexOverride?: number) => {
      console.log('🎵 Starting track:', track.title, 'by', track.artist);
      void (async () => {
        const playableTrack = await resolveTrackForPlayback(track);
        console.log('🎵 Resolved track:', playableTrack.youtubeVideoId ? 'Has YouTube ID' : 'No YouTube ID');

        if (playableTrack.youtubeVideoId) {
          console.log('🎵 Attempting YouTube playback...');
          const started = await startYouTubeTrack(playableTrack, indexOverride);
          if (started) {
            console.log('🎵 YouTube playback started successfully');
            return;
          }
          console.log('🎵 YouTube playback failed, falling back to preview');
        }

        console.log('🎵 Starting preview audio playback...');
        startAudioTrack(playableTrack, indexOverride);
      })();
    },
    [resolveTrackForPlayback, startAudioTrack, startYouTubeTrack]
  );

  useEffect(() => {
    startTrackRef.current = startTrack;
  }, [startTrack]);

  useEffect(() => {
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      updatePlayerState((prev) => ({
        ...prev,
        currentTime: audio.currentTime,
      }));
    };

    const handleLoadedMetadata = () => {
      const actualDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      updatePlayerState((prev) => ({
        ...prev,
        duration: actualDuration || prev.currentTrack?.duration || 0,
      }));
    };

    const handleEnded = () => {
      const { queue, currentIndex } = playerStateRef.current;
      if (queue.length === 0) {
        updatePlayerState((prev) => ({
          ...prev,
          isPlaying: false,
          currentTime: 0,
        }));
        return;
      }

      const nextIndex = (currentIndex + 1) % queue.length;
      startTrack(queue[nextIndex], nextIndex);
    };

    const handlePlay = () => {
      updatePlayerState((prev) => ({
        ...prev,
        isPlaying: true,
        playbackMode: 'audio',
      }));
    };

    const handlePause = () => {
      updatePlayerState((prev) => ({
        ...prev,
        isPlaying: false,
      }));
    };

    const handleError = () => {
      updatePlayerState((prev) => ({
        ...prev,
        isPlaying: false,
      }));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [startTrack, updatePlayerState]);

  useEffect(() => {
    audioRef.current.volume = playerState.volume / 100;
    youtubePlayerRef.current?.setVolume(playerState.volume);
  }, [playerState.volume]);

  useEffect(() => {
    const loadPlaylists = async () => {
      try {
        // Only load playlists if user is authenticated
        if (!user?.id) {
          setPlaylists([]);
          return;
        }
        const { playlists: fromApi } = await api.getPlaylists(user.id);
        setPlaylists(fromApi.length > 0 ? fromApi : []);
      } catch (error) {
        console.error('Failed to load playlists from API:', error);
        setPlaylists([]);
      }
    };

    void loadPlaylists();
  }, [user?.id]);

  useEffect(() => {
    return () => {
      stopYouTubeProgressTimer();
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [stopYouTubeProgressTimer]);

  const playTrack = useCallback((track: Track) => {
    startTrack(track);
  }, [startTrack]);

  const pauseTrack = useCallback(() => {
    if (playerStateRef.current.playbackMode === 'youtube' && youtubePlayerRef.current) {
      youtubePlayerRef.current.pauseVideo();
      return;
    }

    audioRef.current.pause();
  }, []);

  const resumeTrack = useCallback(() => {
    if (playerStateRef.current.playbackMode === 'youtube' && youtubePlayerRef.current) {
      youtubePlayerRef.current.playVideo();
      return;
    }

    if (playerStateRef.current.currentTrack) {
      audioRef.current.play().catch((error) => console.error('Play error:', error));
    }
  }, []);

  const nextTrack = useCallback(() => {
    const { queue, currentIndex } = playerStateRef.current;
    if (queue.length === 0) return;

    const nextIndex = (currentIndex + 1) % queue.length;
    startTrack(queue[nextIndex], nextIndex);
  }, [startTrack]);

  const previousTrack = useCallback(() => {
    const { queue, currentIndex } = playerStateRef.current;
    if (queue.length === 0) return;

    const previousIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
    startTrack(queue[previousIndex], previousIndex);
  }, [startTrack]);

  const setVolume = useCallback((volume: number) => {
    updatePlayerState((prev) => ({
      ...prev,
      volume: Math.max(0, Math.min(100, volume)),
    }));
  }, [updatePlayerState]);

  const setCurrentTime = useCallback((time: number) => {
    if (playerStateRef.current.playbackMode === 'youtube' && youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(time, true);
      updatePlayerState((prev) => ({
        ...prev,
        currentTime: time,
      }));
      return;
    }

    audioRef.current.currentTime = time;
    updatePlayerState((prev) => ({
      ...prev,
      currentTime: time,
    }));
  }, [updatePlayerState]);

  const setQueue = useCallback((tracks: Track[]) => {
    updatePlayerState((prev) => ({
      ...prev,
      queue: tracks,
      currentIndex: 0,
    }));
  }, [updatePlayerState]);

  const createPlaylist = async (name: string, description?: string, imageUrl?: string) => {
    if (!user?.id) {
      throw new Error('Must be logged in to create playlists');
    }
    const { playlist } = await api.createPlaylist({ name, description, imageUrl, userId: user.id });
    setPlaylists((prev) => [...prev, playlist]);
    return playlist;
  };

  const updatePlaylist = async (
    id: string,
    updates: Partial<Pick<Playlist, 'name' | 'description' | 'imageUrl'>>
  ) => {
    if (!user?.id) {
      throw new Error('Must be logged in to update playlists');
    }
    const { playlist } = await api.updatePlaylist(id, updates, user.id);
    setPlaylists((prev) => prev.map((item) => (item.id === id ? playlist : item)));
  };

  const deletePlaylist = async (id: string) => {
    if (!user?.id) {
      throw new Error('Must be logged in to delete playlists');
    }
    await api.deletePlaylist(id, user.id);
    setPlaylists((prev) => prev.filter((item) => item.id !== id));
  };

  const addTrackToPlaylist = async (playlistId: string, track: Track) => {
    if (!user?.id) {
      throw new Error('Must be logged in to add tracks');
    }
    const { playlist } = await api.addTrackToPlaylist(playlistId, track, user.id);
    setPlaylists((prev) => prev.map((item) => (item.id === playlistId ? playlist : item)));
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    if (!user?.id) {
      throw new Error('Must be logged in to remove tracks');
    }
    const { playlist } = await api.removeTrackFromPlaylist(playlistId, trackId, user.id);
    setPlaylists((prev) => prev.map((item) => (item.id === playlistId ? playlist : item)));
  };

  const saveManualYouTubeSource = async (track: Track, youtubeUrl: string) => {
    const response = await api.saveManualYouTubeSource(track, youtubeUrl);
    const mergedTrack: Track = {
      ...track,
      ...response.track,
      id: track.id,
      imageUrl: track.imageUrl || response.track.imageUrl,
      album: response.track.album || track.album,
      duration: response.track.duration || track.duration,
    };
    cacheResolvedTrack(mergedTrack);
    return mergedTrack;
  };

  const isTrackLiked = (trackId: string) => likedTracks.some((track) => track.id === trackId);

  const toggleLikeTrack = (track: Track) => {
    setLikedTracks((prev) => {
      const isLiked = prev.some((item) => item.id === track.id);
      const next = isLiked ? prev.filter((item) => item.id !== track.id) : [...prev, track];

      if (typeof window !== 'undefined') {
        localStorage.setItem(LIKED_TRACKS_STORAGE_KEY, JSON.stringify(next));
      }

      return next;
    });
  };

  const value: MusicContextType = {
    playerState,
    playTrack,
    pauseTrack,
    resumeTrack,
    nextTrack,
    previousTrack,
    setVolume,
    setCurrentTime,
    setQueue,
    recentScrobbles,
    registerYouTubeHost,
    playlists,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    saveManualYouTubeSource,
    user,
    setUser,
    isAuthenticated: !!user,
    likedTracks,
    isTrackLiked,
    toggleLikeTrack,
  };

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within MusicProvider');
  }
  return context;
};
