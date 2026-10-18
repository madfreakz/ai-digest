'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Beat } from '@/lib/summarize';
import type { DisplayArticle } from '@/lib/format';
import UpdatedNewsCard from './UpdatedNewsCard';

interface UpdatedBeatSectionProps {
  articles: DisplayArticle[];
}

const BEATS: Beat[] = ['AI Labs', 'Vertical AI', 'AI Infrastructure', 'Physical AI'];

// Section anchors double as shareable URLs: /#physical-ai
const beatId = (beat: Beat) => beat.toLowerCase().replace(/\s+/g, '-');

// How long a jump link's smooth scroll keeps scroll-spy quiet, so the
// highlight doesn't flicker through the sections in between.
const JUMP_LOCK_MS = 900;

export default function UpdatedBeatSection({ articles }: UpdatedBeatSectionProps) {
  const navRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Partial<Record<Beat, HTMLAnchorElement | null>>>({});
  const sectionRefs = useRef<Partial<Record<Beat, HTMLElement | null>>>({});
  const jumpLockUntil = useRef(0);

  const [activeBeat, setActiveBeat] = useState<Beat | null>(null);
  const [navOffset, setNavOffset] = useState(49);
  const [fade, setFade] = useState({ left: false, right: false });

  const sections = BEATS.map((beat) => ({
    beat,
    items: articles.filter((a) => a.beat === beat),
  }));

  // Measure the sticky nav so jump targets and keyboard focus land below it.
  // Published on <html> because scroll-padding-top lives there (globals.css).
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const root = document.documentElement;
    const measure = () => {
      const px = nav.offsetHeight;
      setNavOffset(px);
      root.style.setProperty('--beat-nav-offset', `${px}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--beat-nav-offset');
    };
  }, []);

  // Scroll-spy: the active beat is the last section whose top has passed the
  // nav. The last section is short, so the bottom of the page selects it.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (performance.now() < jumpLockUntil.current) return;
      const doc = document.documentElement;
      const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
      let current: Beat | null = null;
      for (const beat of BEATS) {
        const el = sectionRefs.current[beat];
        if (el && el.getBoundingClientRect().top <= navOffset + 24) current = beat;
      }
      if (atBottom && current) current = BEATS[BEATS.length - 1];
      setActiveBeat(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [navOffset]);

  // Edge fades show only when there are more links to scroll to (mobile).
  const updateFade = useCallback(() => {
    const s = scrollerRef.current;
    if (!s) return;
    setFade({
      left: s.scrollLeft > 1,
      right: s.scrollLeft + s.clientWidth < s.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    updateFade();
    window.addEventListener('resize', updateFade, { passive: true });
    return () => window.removeEventListener('resize', updateFade);
  }, [updateFade]);

  // Keep the active link visible in the horizontal scroller. Sets scrollLeft
  // directly: scrollIntoView inside a sticky bar can jump the page vertically.
  useEffect(() => {
    const s = scrollerRef.current;
    const link = activeBeat ? linkRefs.current[activeBeat] : null;
    if (!s || !link) return;
    const left = link.offsetLeft - s.offsetLeft;
    const right = left + link.offsetWidth;
    if (left < s.scrollLeft || right > s.scrollLeft + s.clientWidth) {
      s.scrollTo({ left: Math.max(0, left - 24) });
    }
  }, [activeBeat]);

  // The browser's own hash jump (/#physical-ai) can run before the web fonts
  // swap in, and the swap reflows the page. Repeat the jump once they have.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    const beat = BEATS.find((b) => beatId(b) === id);
    if (!beat) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      jumpLockUntil.current = performance.now() + JUMP_LOCK_MS;
      setActiveBeat(beat);
      sectionRefs.current[beat]?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    return () => { cancelled = true; };
  }, []);

  const handleJump = (beat: Beat) => {
    jumpLockUntil.current = performance.now() + JUMP_LOCK_MS;
    setActiveBeat(beat);
  };

  const fadeMask = fade.left || fade.right
    ? `linear-gradient(to right, ${fade.left ? 'transparent 0, #000 32px' : '#000 0'}, ${fade.right ? '#000 calc(100% - 32px), transparent 100%' : '#000 100%'})`
    : undefined;

  return (
    <>
      {/* Sticky in-page navigation. A direct child of <main> so it stays
          stuck across every beat section. */}
      <nav ref={navRef} aria-label="Beats" className="beat-nav">
        <div
          ref={scrollerRef}
          className="beat-nav-scroller"
          onScroll={updateFade}
          style={{ maskImage: fadeMask, WebkitMaskImage: fadeMask }}
        >
          {sections.map(({ beat, items }) => (
            <a
              key={beat}
              ref={(el) => { linkRefs.current[beat] = el; }}
              href={`#${beatId(beat)}`}
              className="beat-nav-link"
              aria-current={activeBeat === beat ? 'location' : undefined}
              onClick={() => handleJump(beat)}
            >
              {beat}
              <span className="beat-nav-count" aria-hidden="true">{items.length}</span>
              <span className="sr-only">, {items.length} {items.length === 1 ? 'story' : 'stories'}</span>
            </a>
          ))}
        </div>
      </nav>

      <div className="beats">
        {sections.map(({ beat, items }) => (
          <section
            key={beat}
            id={beatId(beat)}
            ref={(el) => { sectionRefs.current[beat] = el; }}
            aria-labelledby={`${beatId(beat)}-heading`}
            className="beat-section"
          >
            <h2 id={`${beatId(beat)}-heading`} className="beat-heading">
              {beat}{' '}
              <span className="beat-heading-count">
                {items.length} {items.length === 1 ? 'story' : 'stories'}
              </span>
            </h2>

            {items.length > 0 ? (
              <div className="beat-list">
                {items.map((article) => (
                  <UpdatedNewsCard key={article.storyId} article={article} />
                ))}
              </div>
            ) : (
              <p className="beat-empty">No {beat} stories in today&rsquo;s edition.</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
