import {interpolate, Easing} from 'remotion';

// Soft dissolve at the head and tail of a scene (transition through the white stage).
export const dissolve = (frame: number, duration: number, enter = 14, exit = 16) => {
  const a = interpolate(frame, [0, enter], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const b = interpolate(frame, [duration - exit, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return Math.min(a, b);
};

// Normalised 0..1 progress across a scene.
export const overFrames = (frame: number, duration: number) =>
  interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

export const easeInOut = (t: number) => Easing.inOut(Easing.ease)(t);
