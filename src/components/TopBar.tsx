import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, Settings, UserCircle, LogOut, Menu } from 'lucide-react';
import { useMusic } from '../context/MusicContext';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUser } = useMusic();
  const routeQuery = new URLSearchParams(location.search).get('q') ?? '';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const query = String(formData.get('q') ?? '').trim();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  return (
    <header className="h-16 border-b border-dark-border bg-dark-card/95 backdrop-blur-sm px-4 md:px-6 flex items-center justify-between gap-2 md:gap-4">
      {/* Hamburger Menu for Mobile */}
      <button
        onClick={onToggleSidebar}
        className="md:hidden p-2 rounded-lg text-gray-300 hover:text-white hover:bg-dark-border"
        title="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
        <button
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full bg-dark-bg border border-dark-border text-gray-300 hover:text-white hover:bg-dark-border transition-colors flex items-center justify-center flex-shrink-0"
          title="Go back"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => navigate(1)}
          className="h-10 w-10 rounded-full bg-dark-bg border border-dark-border text-gray-300 hover:text-white hover:bg-dark-border transition-colors flex items-center justify-center flex-shrink-0"
          title="Go forward"
        >
          <ChevronRight size={20} />
        </button>

        <form key={location.search} onSubmit={handleSearchSubmit} className="flex-1 max-w-xl relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={routeQuery}
            placeholder="Search tracks..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-dark-bg border border-dark-border text-sm md:text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-primary"
          />
        </form>
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        <Link
          to="/settings"
          className="h-10 px-2 md:px-3 rounded-lg bg-dark-bg border border-dark-border text-gray-300 hover:text-white hover:border-blue-primary flex items-center gap-2 whitespace-nowrap"
        >
          <Settings size={16} />
          <span className="hidden sm:inline">Settings</span>
        </Link>
        {user ? (
          <>
            <div className="h-10 px-2 md:px-3 rounded-lg bg-dark-bg border border-dark-border text-gray-200 flex items-center gap-2 whitespace-nowrap">
              {user.profileImage ? (
                <img src={user.profileImage} alt={user.username} className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <UserCircle size={16} />
              )}
              <span className="hidden sm:inline text-sm md:text-base">{user.username}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="h-10 px-2 md:px-3 rounded-lg bg-dark-bg border border-dark-border text-gray-300 hover:text-red-400"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="h-10 px-3 rounded-lg bg-blue-primary text-white font-semibold hover:bg-blue-secondary flex items-center gap-2 whitespace-nowrap"
          >
            <UserCircle size={16} />
            <span className="hidden sm:inline">Login</span>
          </Link>
        )}
      </div>
    </header>
  );
};
