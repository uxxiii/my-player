import { Navigate } from 'react-router-dom';
import { useMusic } from '../context/MusicContext';

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
