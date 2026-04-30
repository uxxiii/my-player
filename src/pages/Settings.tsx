import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, User, Moon, LogOut } from 'lucide-react';
import { useMusic } from '../context/MusicContext';

export const Settings: React.FC = () => {
  const { user, setUser, likedTracks, playlists } = useMusic();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');

  const handleSaveProfile = () => {
    if (user) {
      setUser({
        ...user,
        username,
        email,
      });
      alert('Profile updated successfully!');
    }
  };

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  if (!user) {
    return (
      <div className="main-content p-6 max-w-4xl">
        <div className="rounded-[2rem] border border-white/10 bg-dark-card p-8 shadow-2xl shadow-black/20">
          <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Account</p>
          <h1 className="mt-2 text-4xl font-bold text-white">Sign in to save your profile</h1>
          <p className="mt-3 max-w-2xl text-gray-400">
            Log in with Google so your profile, playlists, and likes stay attached to your account.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="inline-flex items-center rounded-2xl bg-blue-primary px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-secondary"
            >
              Go to Login
            </Link>
            <Link
              to="/"
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-2">
          <SettingsIcon size={36} className="text-blue-primary" />
          Settings
        </h1>
        <p className="text-gray-400">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <section className="bg-dark-card border border-dark-border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <User size={20} className="text-blue-primary" />
          Profile Settings
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-primary transition-colors"
            />
          </div>

          <button
            onClick={handleSaveProfile}
            className="w-full bg-blue-primary hover:bg-blue-secondary text-white px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            Save Changes
          </button>
        </div>
      </section>

      {/* Preferences Section */}
      <section className="bg-dark-card border border-dark-border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Moon size={20} className="text-blue-primary" />
          Preferences
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
            <span className="text-gray-300">Dark Theme</span>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-primary" />
          </div>

          <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
            <span className="text-gray-300">Enable Notifications</span>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-primary" />
          </div>

          <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
            <span className="text-gray-300">Auto Play</span>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-primary" />
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="bg-dark-card border border-dark-border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-white mb-4">Statistics</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-dark-bg rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">Liked Tracks</p>
            <p className="text-3xl font-bold text-blue-primary">{likedTracks.length}</p>
          </div>

          <div className="bg-dark-bg rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">Total Playlists</p>
            <p className="text-3xl font-bold text-blue-primary">{playlists.length}</p>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-dark-card border border-red-500/30 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Danger Zone</h2>

        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={18} />
          Logout
        </button>

        <p className="text-sm text-gray-400 mt-4">You will be logged out and need to log in again to access your account.</p>
      </section>
    </div>
  );
};
