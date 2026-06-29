import {interpolate, spring, Easing} from 'remotion';

// Soft dissolve at the head and tail of a scene.
export const dissolve = (frame: number, duration: number, enter = 12, exit = 12) => {
  const a = interpolate(frame, [0, enter], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const b = interpolate(frame, [duration - exit, duration], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return Math.min(a, b);
};

// Normalised 0..1 progress across a scene.
export const overFrames = (frame: number, duration: number) =>
  interpolate(frame, [0, duration], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

export const easeInOut = (t: number) => Easing.inOut(Easing.ease)(t);

// Continuous "camera" motion across a whole scene. Five looks, cycled by seed,
// so two scenes in a row never move the same way. Values are subtle on purpose.
export const camera = (frame: number, duration: number, seed = 0) => {
  const e = easeInOut(overFrames(frame, duration));
  const variants = [
    {scale: [1.0, 1.06], x: [0, 0], y: [0, 0]},     // slow zoom in
    {scale: [1.06, 1.0], x: [0, 0], y: [0, 0]},     // slow zoom out
    {scale: [1.045, 1.045], x: [-1.3, 1.3], y: [0, 0]}, // pan right
    {scale: [1.045, 1.045], x: [1.3, -1.3], y: [0, 0]}, // pan left
    {scale: [1.03, 1.055], x: [0, 0], y: [0.9, -0.9]},  // float up
  ];
  const v = variants[((seed % variants.length) + variants.length) % variants.length];
  const scale = interpolate(e, [0, 1], v.scale);
  const x = interpolate(e, [0, 1], v.x);
  const y = interpolate(e, [0, 1], v.y);
  return {transform: `scale(${scale}) translate(${x}%, ${y}%)`};
};

// Scene entrance. Four directions, cycled by seed: rise, slide from right, slide
// from left, scale-and-blur in. Fast and clean.
export const enterIn = (frame: number, fps: number, seed = 0) => {
  const s = spring({frame, fps, config: {damping: 200, mass: 0.7}});
  const variants = [
    {x: [0, 0], y: [70, 0], scale: [0.98, 1], blur: [0, 0]},
    {x: [110, 0], y: [0, 0], scale: [1, 1], blur: [0, 0]},
    {x: [-110, 0], y: [0, 0], scale: [1, 1], blur: [0, 0]},
    {x: [0, 0], y: [0, 0], scale: [1.08, 1], blur: [0, 0]},
  ];
  const v = variants[((seed % variants.length) + variants.length) % variants.length];
  const x = interpolate(s, [0, 1], v.x);
  const y = interpolate(s, [0, 1], v.y);
  const scale = interpolate(s, [0, 1], v.scale);
  const blur = interpolate(s, [0, 1], v.blur);
  return {opacity: s, x, y, scale, blur, transform: `translate(${x}px, ${y}px) scale(${scale})`};
};

// Linear fade in the last `frames` of a scene (the outgoing half of a transition).
export const exitFade = (frame: number, duration: number, frames = 11) =>
  interpolate(frame, [duration - frames, duration], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

// Gentle perpetual float (px), for cards and tiles so nothing sits dead still.
export const floaty = (frame: number, amp = 6, speed = 70, phase = 0) =>
  Math.sin(frame / speed + phase) * amp;
