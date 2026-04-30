import React, { useEffect, useRef } from 'react';
import { useMusic } from '../context/MusicContext';

export const YouTubeHostBridge: React.FC = () => {
  const { registerYouTubeHost } = useMusic();
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    registerYouTubeHost(hostRef.current);
    return () => registerYouTubeHost(null);
  }, [registerYouTubeHost]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed -left-[9999px] -top-[9999px] h-px w-px overflow-hidden opacity-0"
    >
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
};
