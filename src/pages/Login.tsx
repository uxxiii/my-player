import React, { useMemo, useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Sparkles, Music } from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { parseGoogleCredential } from '../lib/googleAuth';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, user } = useMusic();
  const [error, setError] = useState('');

  const googleClientId = useMemo(() => import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '', []);

  const handleLoginSuccess = (response: CredentialResponse) => {
    const profile = parseGoogleCredential(response.credential);
    if (!profile?.sub || !profile.email) {
      setError('Google sign-in succeeded, but no profile information was returned.');
      return;
    }

    const username = profile.name?.trim() || profile.email.split('@')[0];

    setUser({
      id: profile.sub,
      username,
      email: profile.email,
      profileImage: profile.picture,
      playlists: user?.playlists ?? [],
      likedTracks: user?.likedTracks ?? [],
      provider: 'google',
    });

    navigate('/');
  };

  if (!googleClientId) {
    return (
      <div className="main-content p-6">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-dark-card p-8 shadow-2xl shadow-black/20">
          <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Authentication</p>
          <h1 className="mt-2 text-4xl font-bold text-white">Google login is not configured</h1>
          <p className="mt-3 text-gray-400">
            Add <span className="font-semibold text-white">VITE_GOOGLE_CLIENT_ID</span> in Vercel to enable sign in.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center rounded-2xl bg-blue-primary px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-secondary"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content p-6">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-white/10 bg-dark-card p-8 shadow-2xl shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-blue-primary/15 text-blue-accent">
              <Music size={24} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">MyPlayer Login</p>
              <h1 className="text-3xl font-bold text-white">Sign in with Google</h1>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-400">
            Log in to keep your playlists, likes, and profile synced inside MyPlayer.
          </p>

          <div className="mt-8 flex flex-col gap-4">
            <div className="inline-flex w-full justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <GoogleLogin
                onSuccess={handleLoginSuccess}
                onError={() => setError('Google sign-in failed. Please try again.')}
                shape="pill"
                size="large"
                text="signin_with"
                theme="filled_black"
                width="320"
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Back to Home
            </Link>
          </div>
        </section>

        <aside className="rounded-[2rem] border border-white/10 bg-dark-card p-8">
          <div className="flex items-center gap-2 text-blue-accent">
            <Shield size={18} />
            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Why login</p>
          </div>

          <div className="mt-6 space-y-3 text-sm text-gray-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">Keep your profile on this device.</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">Save likes and playlists under one account.</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">Safer than storing manual usernames and passwords.</div>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
            <Sparkles size={16} className="text-blue-primary" />
            <span>You can still browse the site, but login unlocks your saved profile.</span>
          </div>
        </aside>
      </div>
    </div>
  );
};