import { Navigate, Routes, Route } from 'react-router-dom';
import { useMusic } from '../context/MusicContext';
import { Login } from '../pages/Login';

export const AuthGuard: React.FC = () => {
  const { user } = useMusic();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return null; // Will render AppContent when user exists
};

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user } = useMusic();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
