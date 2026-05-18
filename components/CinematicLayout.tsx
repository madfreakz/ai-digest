'use client';

import type { Digest } from '@/lib/summarize';
import { useTheme } from './DigestClient';
import ScrollProgressBar from './ScrollProgressBar';
import DigestHeader from './DigestHeader';
import HeroFeaturedStory from './HeroFeaturedStory';
import UpdatedBeatSection from './UpdatedBeatSection';

interface CinematicLayoutProps {
  digest: Digest;
}

export default function CinematicLayout({ digest }: CinematicLayoutProps) {
  const { t: theme } = useTheme();

  // Find featured article (dealSignal + highest composite score)
  const featured = digest.articles.find((a) => a.dealSignal) || digest.articles[0];
  const remaining = digest.articles.filter((a) => a !== featured);

  return (
    <div
      style={{
        background: theme.bg,
        color: '#18140C',
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      <ScrollProgressBar />

      <main style={{ position: 'relative', zIndex: 2 }}>
        {/* Masthead rule with gradient backdrop */}
        <div
          style={{
            height: `${theme.mastheadH}px`,
            background: `linear-gradient(180deg, rgba(27, 58, 107, 0.08) 0%, ${theme.mastheadBg} 100%)`,
            width: '100%',
            borderBottom: `1px solid rgba(27, 58, 107, 0.1)`,
          }}
        />

        {/* Header section with semi-transparent background */}
        <div
          style={{
            background: `linear-gradient(180deg, rgba(250, 248, 244, 0.35) 0%, rgba(250, 248, 244, 0.25) 100%)`,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            borderBottom: `1px solid rgba(27, 58, 107, 0.08)`,
          }}
        >
          <DigestHeader generatedAt={digest.generatedAt} />
        </div>

        {/* Hero Featured Story Section */}
        <div
          style={{
            background: `linear-gradient(180deg, rgba(250, 248, 244, 0.25) 0%, rgba(250, 248, 244, 0.15) 100%)`,
            borderBottom: `1px solid rgba(27, 58, 107, 0.08)`,
          }}
        >
          {featured && <HeroFeaturedStory article={featured} compact={false} />}
        </div>

        {/* Beat Section with articles */}
        {remaining.length > 0 && <UpdatedBeatSection articles={remaining} />}

        {/* Divider before footer */}
        <div
          style={{
            height: '1px',
            background: `linear-gradient(90deg, transparent 0%, ${theme.borderLight} 20%, ${theme.borderLight} 80%, transparent 100%)`,
            margin: 'clamp(60px, 10vw, 80px) var(--page-pad-x)',
          }}
        />

        {/* Footer */}
        <footer
          style={{
            padding: 'clamp(40px, 8vw, 60px) var(--page-pad-x)',
            background: `linear-gradient(180deg, rgba(250, 248, 244, 0.30) 0%, rgba(250, 248, 244, 0.40) 100%)`,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            borderTop: `1px solid rgba(27, 58, 107, 0.10)`,
            borderBottom: `1px solid rgba(27, 58, 107, 0.08)`,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              color: theme.textGhost,
              fontWeight: 300,
              margin: 0,
            }}
          >
            © Mark Fok · Frontier AI Digest
          </p>
        </footer>
      </main>

      {/* Limestone texture background */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#FAF8F4',
          backgroundImage: 'url(/limestone-texture.jpg)',
          backgroundSize: '250%',
          backgroundPosition: '0 0',
          backgroundRepeat: 'repeat',
          backgroundAttachment: 'fixed',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Content overlay for readability */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: `linear-gradient(180deg,
            rgba(250, 248, 244, 0.92) 0%,
            rgba(250, 248, 244, 0.88) 20%,
            rgba(250, 248, 244, 0.80) 50%,
            rgba(250, 248, 244, 0.88) 80%,
            rgba(250, 248, 244, 0.92) 100%)`,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    </div>
  );
}
