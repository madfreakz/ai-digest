import type { Digest } from '@/lib/summarize';
import { getSynthesisHero } from '@/lib/summarize';
import { formatEditionDate, toDisplayArticle } from '@/lib/format';
import DigestHeader from './DigestHeader';
import HeroFeaturedStory from './HeroFeaturedStory';
import UpdatedBeatSection from './UpdatedBeatSection';

interface CinematicLayoutProps {
  digest: Digest;
}

// Server component: the page arrives fully rendered, and the lead-story pick
// (getSynthesisHero, in lib/summarize) never reaches the browser bundle.
export default function CinematicLayout({ digest }: CinematicLayoutProps) {
  const featured = getSynthesisHero(digest) ?? digest.articles[0];
  const remaining = digest.articles.filter((a) => a !== featured).map(toDisplayArticle);

  return (
    <main>
      <div className="masthead-rule" />

      <DigestHeader
        editionDate={formatEditionDate(digest.generatedAt)}
        thesis={digest.synthesis?.thesis}
      />

      {featured && <HeroFeaturedStory article={toDisplayArticle(featured)} />}

      {remaining.length > 0 && <UpdatedBeatSection articles={remaining} />}

      <footer className="site-footer">
        <p>
          ©{" "}
          <a href="https://www.linkedin.com/in/markfok/" target="_blank" rel="noopener noreferrer">
            Mark Fok
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="#0A66C2"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            <span className="sr-only"> on LinkedIn</span>
          </a>{" "}
          · Frontier AI Digest
        </p>
      </footer>
    </main>
  );
}
