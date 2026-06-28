import React, {useEffect, useRef, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

// A render-safe image. It preloads the url and only ever blocks the render for
// up to `timeoutMs`. If the image loads, it paints (from cache, instantly). If
// it is missing, slow, or not a real image, the render simply continues and this
// renders nothing. This guarantees a single bad asset can never stall a render
// the way a raw <Img> can (which waits the full global timeout, failing the job).
export const SafeImg: React.FC<{
  src?: string;
  style?: React.CSSProperties;
  timeoutMs?: number;
}> = ({src, style, timeoutMs = 8000}) => {
  const [handle] = useState(() => delayRender(`SafeImg: ${src ?? 'none'}`));
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');
  const doneRef = useRef(false);

  useEffect(() => {
    const finish = (s: 'ok' | 'fail') => {
      if (doneRef.current) return;
      doneRef.current = true;
      setState(s);
      continueRender(handle);
    };
    if (!src) {
      finish('fail');
      return;
    }
    const img = new window.Image();
    img.onload = () => finish('ok');
    img.onerror = () => finish('fail');
    img.src = src;
    if (img.complete && img.naturalWidth > 0) finish('ok');
    const t = setTimeout(() => finish('fail'), timeoutMs);
    return () => {
      clearTimeout(t);
      if (!doneRef.current) {
        doneRef.current = true;
        continueRender(handle);
      }
    };
  }, [src, handle, timeoutMs]);

  if (state !== 'ok' || !src) return null;
  // Already preloaded and cached, so a native img paints immediately.
  return <img src={src} style={style} alt="" />;
};
