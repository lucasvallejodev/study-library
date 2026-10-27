'use client';

import { useState } from 'react';

export type ZoomedImage = {
  alt: string;
  src: string;
};

type ImageLightboxProps = {
  image?: ZoomedImage;
  onClose: () => void;
};

type FittedSize = {
  height: number;
  width: number;
};

const VIEWPORT_WIDTH_SHARE = 0.95;
const VIEWPORT_HEIGHT_SHARE = 0.85;

export function zoomableImageOf(target: EventTarget): ZoomedImage | undefined {
  if (!(target instanceof HTMLImageElement)) return undefined;

  return { alt: target.alt, src: target.currentSrc || target.src };
}

function fitToViewport(image: HTMLImageElement): FittedSize {
  const scale = Math.min(
    (window.innerWidth * VIEWPORT_WIDTH_SHARE) / image.naturalWidth,
    (window.innerHeight * VIEWPORT_HEIGHT_SHARE) / image.naturalHeight
  );

  return { height: image.naturalHeight * scale, width: image.naturalWidth * scale };
}

export function ImageLightbox({ image, onClose }: ImageLightboxProps) {
  const [size, setSize] = useState<FittedSize>();

  if (!image) return null;

  function close() {
    setSize(undefined);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-label={image.alt || 'Image'}
      className="fixed inset-0 z-50 flex cursor-zoom-out flex-col items-center justify-center gap-3 bg-black/85 p-4"
      onClick={close}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- chapter images are served by the library asset route */}
      <img
        src={image.src}
        alt={image.alt}
        onLoad={event => setSize(fitToViewport(event.currentTarget))}
        style={size}
        className="rounded bg-paper object-contain"
      />
      {image.alt && <p className="max-w-3xl text-center text-sm text-white/80">{image.alt}</p>}
    </div>
  );
}
