import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HERO_IMAGES, HeroImageItem } from './hero-images.data';

interface HeroImageCarouselProps {
  images?: HeroImageItem[];
  intervalMs?: number;
  className?: string;
}

export const HeroImageCarousel: React.FC<HeroImageCarouselProps> = ({
  images = HERO_IMAGES,
  intervalMs = 3000,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Preload upcoming image to avoid any flashing or load latency
  const preloadImage = useCallback((index: number) => {
    const item = images[index];
    if (!item) return;
    const img = new Image();
    img.src = item.url;
  }, [images]);

  // Preload next image whenever current index changes
  useEffect(() => {
    const nextIndex = (currentIndex + 1) % images.length;
    preloadImage(nextIndex);
    // Preload next+1 for buttery smooth carousel transitions
    const nextNextIndex = (currentIndex + 2) % images.length;
    preloadImage(nextNextIndex);
  }, [currentIndex, images.length, preloadImage]);

  // Single carousel timer logic
  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, intervalMs, images.length]);

  const activeImage = images[currentIndex];

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="ApprovalIQ Industry & Infrastructure Visual Showcase"
    >
      {/* Background Images with smooth Ken Burns scale + crossfade */}
      {images.map((item, idx) => {
        const isActive = idx === currentIndex;
        return (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out pointer-events-none ${
              isActive ? 'opacity-100 z-0' : 'opacity-0 -z-10'
            }`}
            aria-hidden={!isActive}
          >
            <img
              src={item.url}
              alt={item.alt}
              className={`w-full h-full object-cover object-center transform transition-transform duration-[4000ms] ease-out ${
                isActive ? 'scale-105' : 'scale-100'
              }`}
              loading={idx === 0 ? 'eager' : 'lazy'}
            />
            {/* Subtle multi-layer gradient overlays for visual depth and text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-brand-navy-900/80 via-brand-navy-900/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-brand-navy-900/50 via-transparent to-brand-navy-900/30" />
            <div className="absolute inset-0 bg-brand-primary-900/10 mix-blend-multiply" />
          </div>
        );
      })}

      {/* Bottom overlay: Location pill, active industry tag, and subtle progress indicator */}
      {activeImage && (
        <div className="absolute bottom-5 left-5 right-5 z-20 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2.5 bg-brand-navy-900/70 backdrop-blur-md border border-white/15 px-3.5 py-1.5 rounded-full shadow-lg text-white text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white/95">{activeImage.category}</span>
            <span className="text-white/40">•</span>
            <span className="text-white/80 text-[11px]">{activeImage.location}</span>
          </div>

          {/* Carousel indicators / Dots */}
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  idx === currentIndex
                    ? 'w-6 bg-brand-primary-400'
                    : 'w-1.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
                aria-current={idx === currentIndex ? 'true' : 'false'}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
