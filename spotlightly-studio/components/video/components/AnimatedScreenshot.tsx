import React from 'react';
import {Img, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {asset} from '../lib/assets';
import {easeInOut, overFrames} from '../lib/animations';

type Pan = [number, number];

// A framed screenshot with a slow zoom, a pan across the image, and gentle parallax
// drift. For tall page captures, the default pan scrolls top to bottom.
export const AnimatedScreenshot: React.FC<{
  src: string;
  durationInFrames: number;
  width?: number;
  height?: number;
  zoom?: [number, number];
  panFrom?: Pan;
  panTo?: Pan;
  fit?: 'cover' | 'contain';
  radius?: number;
}> = ({
  src,
  durationInFrames,
  width = 800,
  height = 1300,
  zoom = [1.05, 1.13],
  panFrom = [50, 2],
  panTo = [50, 98],
  fit = 'cover',
  radius = theme.radius,
}) => {
  const frame = useCurrentFrame();
  const t = easeInOut(overFrames(frame, durationInFrames));
  const scale = interpolate(t, [0, 1], zoom);
  const px = interpolate(t, [0, 1], [panFrom[0], panTo[0]]);
  const py = interpolate(t, [0, 1], [panFrom[1], panTo[1]]);
  const drift = interpolate(t, [0, 1], [12, -12]);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: 'hidden',
        boxShadow: theme.colors.shadow,
        background: theme.colors.cardBg,
        border: `1px solid ${theme.colors.line}`,
        transform: `translateY(${drift}px)`,
      }}
    >
      <Img
        src={asset(src) as string}
        style={{
          width: '100%',
          height: '100%',
          objectFit: fit,
          objectPosition: `${px}% ${py}%`,
          transform: `scale(${scale})`,
          transformOrigin: `${px}% ${py}%`,
        }}
      />
    </div>
  );
};
