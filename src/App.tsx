import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Navigation } from './components/Navigation';
import { PlaylistComposer } from './components/PlaylistComposer';
import { Player } from './components/Player';
import { TopBar } from './components/TopBar';
import { YouTubeHostBridge } from './components/YouTubeHostBridge';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Playlist } from './pages/Playlist';
import { Settings } from './pages/Settings';
import { LikedSongs } from './pages/LikedSongs';
import { NowPlayingPanel } from './components/NowPlayingPanel';
import { MusicProvider } from './context/MusicContext';
import { AuthGuard } from './components/ProtectedRoute';

const LEFT_PANEL_MIN = 232;
const LEFT_PANEL_MAX = 420;
const LEFT_PANEL_RAIL = 88;
const RIGHT_PANEL_MIN = 280;
const RIGHT_PANEL_MAX = 460;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const ResizeHandle: React.FC<{ onPointerDown: () => void; className?: string }> = ({
  onPointerDown,
  className = '',
}) => (
  <button
    type="button"
    aria-label="Resize panel"
    onPointerDown={onPointerDown}
    className={`app-resize-handle ${className}`}
  >
    <span className="app-resize-handle__line" />
  </button>
);

function AppContent() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [draggingPanel, setDraggingPanel] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    if (!draggingPanel) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (draggingPanel === 'left') {
        const nextWidth = clamp(event.clientX, LEFT_PANEL_MIN, LEFT_PANEL_MAX);
        setLeftPanelWidth(nextWidth);
        return;
      }

      const nextWidth = clamp(window.innerWidth - event.clientX, RIGHT_PANEL_MIN, RIGHT_PANEL_MAX);
      setRightPanelWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setDraggingPanel(null);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingPanel]);

  const layoutStyle = {
    '--player-height': '7.75rem',
  } as CSSProperties;
  const desktopLeftPanelWidth = isLeftPanelCollapsed ? LEFT_PANEL_RAIL : leftPanelWidth;

  return (
    <div className="h-screen overflow-hidden bg-dark-bg text-white" style={layoutStyle}>
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 md:hidden ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Navigation
          onOpenCreatePlaylist={() => {
            setMobileSidebarOpen(false);
            setIsCreatePlaylistOpen(true);
          }}
        />
      </div>

      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <div className="flex h-full min-h-0 pb-[var(--player-height)]">
        <div className="hidden h-full shrink-0 md:block" style={{ width: desktopLeftPanelWidth }}>
          <Navigation
            isCollapsed={isLeftPanelCollapsed}
            onToggleCollapse={() => setIsLeftPanelCollapsed((prev) => !prev)}
            onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
          />
        </div>
        {!isLeftPanelCollapsed && (
          <ResizeHandle
            onPointerDown={() => setDraggingPanel('left')}
            className="hidden md:flex"
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)} />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/search" element={<Search />} />
                <Route path="/playlist/:id" element={<Playlist />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/liked" element={<LikedSongs />} />
              </Routes>
            </div>

            <ResizeHandle
              onPointerDown={() => setDraggingPanel('right')}
              className="hidden md:flex"
            />
            <div className="hidden h-full shrink-0 md:block" style={{ width: rightPanelWidth }}>
              <NowPlayingPanel />
            </div>
          </div>
        </main>

        <YouTubeHostBridge />
        <Player />
      </div>

      <PlaylistComposer
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
      />
    </div>
  );
}

function App() {
  return (
    <MusicProvider>
      <Router>
        <AuthGuard />
        <AppContent />
      </Router>
    </MusicProvider>
  );
}

export default App;
