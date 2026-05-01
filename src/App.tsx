import { BrowserRouter as Router } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { MusicProvider } from './context/MusicContext';
import { AuthGuard } from './components/ProtectedRoute';

function App() {
  return (
    <MusicProvider>
      <Router>
        <AuthGuard />
      </Router>
      <Analytics />
    </MusicProvider>
  );
}

export default App;
