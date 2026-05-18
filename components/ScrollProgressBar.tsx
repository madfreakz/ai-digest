'use client';

import { useEffect, useState } from 'react';
import { useTheme } from './DigestClient';

export default function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);
  const theme = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '2px',
        width: `${progress}%`,
        background: theme.scrollProgressGradient,
        zIndex: 100,
        transition: 'width 0.05s linear',
      }}
    />
  );
}
