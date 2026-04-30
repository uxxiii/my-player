import { BrowserRouter as Router } from 'react-router-dom';
import { MusicProvider } from './context/MusicContext';
import { AuthGuard } from './components/ProtectedRoute';

function App() {
  return (
    <MusicProvider>
      <Router>
        <AuthGuard />
      </Router>
    </MusicProvider>
  );
}

export default App;
