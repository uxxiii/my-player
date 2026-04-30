import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Shield, Sparkles } from 'lucide-react';
import { SiSpotify } from 'react-icons/si';
import { useMusic } from '../context/MusicContext';
import { api } from '../lib/api';
import type { Track } from '../types';

type SpotifyPlaylist = {
  id: string;
  name: string;
  imageUrl?: string;
  tracksCount: number;
};

const STORAGE_KEY = 'myplayer_spotify_auth';

type StoredAuth = {
  accessToken: string;
  expiresAt: number;
};

const readStoredAuth = (): StoredAuth | null => {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed.accessToken || !parsed.expiresAt) return null;
    if (Date.now() >= parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const SpotifyImport: React.FC = () => {
  const navigate = useNavigate();
  const { importSpotifyPlaylist } = useMusic();
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [importingIds, setImportingIds] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [auth, setAuth] = useState<StoredAuth | null>(() => readStoredAuth());

  const redirectUri = useMemo(
    () => import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/spotify-import`,
    []
  );

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) return;

    const exchangeCode = async () => {
      try {
        setError('');
        setStatus('Connecting to Spotify...');
        const token = await api.exchangeSpotifyCode(code, redirectUri);
        const stored: StoredAuth = {
          accessToken: token.access_token,
          expiresAt: Date.now() + token.expires_in * 1000,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        setAuth(stored);
        setStatus('Spotify account connected. Loading playlists...');
        window.history.replaceState({}, document.title, '/spotify-import');
      } catch (exchangeError) {
        console.error('Spotify exchange failed:', exchangeError);
        setError('Could not connect your Spotify account. Please try again.');
        setStatus('');
      }
    };

    void exchangeCode();
  }, [redirectUri]);

  useEffect(() => {
    const loadPlaylists = async () => {
      if (!auth?.accessToken) return;

      setLoadingPlaylists(true);
      try {
        const response = await api.getSpotifyPlaylists(auth.accessToken);
        setPlaylists(response.playlists);
        setSelectedIds(response.playlists.slice(0, 1).map((playlist) => playlist.id));
        setStatus('Choose the playlists you want to import.');
      } catch (loadError) {
        console.error('Failed to load Spotify playlists:', loadError);
        setError('Could not load your Spotify playlists. Please reconnect.');
        localStorage.removeItem(STORAGE_KEY);
        setAuth(null);
      } finally {
        setLoadingPlaylists(false);
      }
    };

    void loadPlaylists();
  }, [auth]);

  const startSpotifyLogin = async () => {
    try {
      setError('');
      setStatus('Redirecting to Spotify...');
      const { authUrl } = await api.getSpotifyAuthUrl(redirectUri);
      window.location.assign(authUrl);
    } catch (loginError) {
      console.error('Spotify auth url failed:', loginError);
      setError('Unable to start Spotify login. Check your backend Spotify credentials.');
      setStatus('');
    }
  };

  const toggleSelection = (playlistId: string) => {
    setSelectedIds((prev) =>
      prev.includes(playlistId) ? prev.filter((item) => item !== playlistId) : [...prev, playlistId]
    );
  };

  const importOnePlaylist = async (playlist: SpotifyPlaylist) => {
    if (!auth?.accessToken) return;

    setImportingIds((prev) => [...prev, playlist.id]);
    setError('');
    try {
      const response = await api.getSpotifyPlaylistTracks(auth.accessToken, playlist.id);
      const importedTracks = response.tracks.filter((track) => Boolean(track.title) && Boolean(track.artist)) as Track[];
      await importSpotifyPlaylist(playlist.name, playlist.imageUrl, importedTracks);
    } catch (importError) {
      console.error('Playlist import failed:', importError);
      setError(`Failed to import ${playlist.name}.`);
    } finally {
      setImportingIds((prev) => prev.filter((item) => item !== playlist.id));
    }
  };

  const importSelected = async () => {
    const selectedPlaylists = playlists.filter((playlist) => selectedIds.includes(playlist.id));
    if (selectedPlaylists.length === 0) return;

    setStatus(`Importing ${selectedPlaylists.length} playlist${selectedPlaylists.length > 1 ? 's' : ''}...`);
    setError('');

    for (const playlist of selectedPlaylists) {
      await importOnePlaylist(playlist);
    }

    setStatus('Import complete. Your playlists are now in MyPlayer.');
  };

  const connectLabel = auth ? 'Reconnect Spotify' : 'Connect Spotify';

  return (
    <div className="main-content p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row">
        <section className="flex-1 rounded-[2rem] border border-white/10 bg-dark-card p-6 shadow-2xl shadow-black/20">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-green-500/10 text-green-400">
              <SiSpotify size={24} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Spotify Import</p>
              <h1 className="text-3xl font-bold text-white">Bring your Spotify playlists over</h1>
            </div>
          </div>

          <p className="max-w-2xl text-sm leading-6 text-gray-400">
            Connect your Spotify account, pick the playlists you want, and MyPlayer will copy the playlist structure
            and as many playable tracks as Spotify exposes through its API.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void startSpotifyLogin()}
              className="inline-flex items-center gap-2 rounded-2xl bg-green-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-green-400"
            >
              <SiSpotify size={18} />
              {connectLabel}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Back to Home
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              'OAuth is handled by your backend, so your client secret stays out of the browser.',
              'Selected playlists are copied into MyPlayer as local playlists.',
              'Imported tracks keep artwork and preview audio when Spotify exposes it.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-300">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
            <Shield size={16} className="text-blue-primary" />
            <span>
              You need `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the backend environment for this to work.
            </span>
          </div>

          {status && (
            <div className="mt-5 rounded-2xl border border-blue-primary/30 bg-blue-primary/10 px-4 py-3 text-sm text-blue-100">
              {status}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </section>

        <aside className="w-full rounded-[2rem] border border-white/10 bg-dark-card p-6 lg:max-w-xl">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Your Spotify Playlists</h2>
              <p className="text-sm text-gray-400">Select one or more playlists to import.</p>
            </div>
            {loadingPlaylists && <Loader2 className="animate-spin text-blue-primary" size={18} />}
          </div>

          {!auth ? (
            <div className="rounded-2xl border border-dashed border-dark-border bg-dark-bg px-4 py-8 text-center text-sm text-gray-400">
              Connect Spotify first to load your playlists.
            </div>
          ) : playlists.length === 0 && !loadingPlaylists ? (
            <div className="rounded-2xl border border-dashed border-dark-border bg-dark-bg px-4 py-8 text-center text-sm text-gray-400">
              No playlists found in your Spotify account.
            </div>
          ) : (
            <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
              {playlists.map((playlist) => {
                const selected = selectedIds.includes(playlist.id);
                const importing = importingIds.includes(playlist.id);

                return (
                  <button
                    key={playlist.id}
                    type="button"
                    onClick={() => toggleSelection(playlist.id)}
                    className={`flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-blue-primary bg-blue-primary/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    {playlist.imageUrl ? (
                      <img src={playlist.imageUrl} alt={playlist.name} className="h-14 w-14 rounded-2xl object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-green-400">
                        <SiSpotify size={20} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{playlist.name}</p>
                      <p className="text-sm text-gray-400">{playlist.tracksCount} tracks</p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {importing ? (
                        <Loader2 className="animate-spin text-blue-primary" size={18} />
                      ) : selected ? (
                        <Check className="text-blue-primary" size={18} />
                      ) : null}
                      <span className="text-xs text-gray-500">{selected ? 'Selected' : 'Tap to select'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => setSelectedIds(playlists.map((playlist) => playlist.id))}
              className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => void importSelected()}
              disabled={!auth || selectedIds.length === 0 || loadingPlaylists}
              className="flex-1 rounded-2xl bg-blue-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import Selected
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">
            <div className="mb-2 flex items-center gap-2 text-white">
              <Sparkles size={16} className="text-blue-primary" />
              <span className="font-semibold">What gets imported</span>
            </div>
            <ul className="space-y-2">
              <li>• Playlist name and cover art</li>
              <li>• Track metadata and order</li>
              <li>• Preview audio when Spotify provides it</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};
