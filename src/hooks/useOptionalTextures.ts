import { useEffect, useState } from 'react';
import * as THREE from 'three';

/* ---------------------------------------------------------------------------
 * Load textures that are allowed to be missing.
 *
 * drei's useTexture suspends and then THROWS if a file cannot be fetched,
 * which would take down the whole 3D scene because someone mistyped a
 * filename. Here a picture that fails to load simply never appears, and the
 * city carries on around it - the same rule the rest of the portfolio follows
 * for content that has not been filled in.
 * ------------------------------------------------------------------------- */

export function useOptionalTextures(urls: string[]): Record<string, THREE.Texture> {
  const [loaded, setLoaded] = useState<Record<string, THREE.Texture>>({});

  // Keyed on the joined list rather than the array, whose identity changes on
  // every render even when the contents have not.
  const key = urls.join('|');

  useEffect(() => {
    if (urls.length === 0) return;

    let alive = true;
    const loader = new THREE.TextureLoader();
    const mine: THREE.Texture[] = [];

    for (const url of urls) {
      loader.load(
        url,
        (texture) => {
          // Photographs are authored in sRGB; without this they render washed
          // out and pale once three.js treats them as linear data.
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 4;
          texture.needsUpdate = true;

          if (!alive) {
            texture.dispose();
            return;
          }
          mine.push(texture);
          setLoaded((prev) => ({ ...prev, [url]: texture }));
        },
        undefined,
        () => {
          if (import.meta.env.DEV) {
            console.warn(`[portfolio] could not load image: ${url}`);
          }
        },
      );
    }

    return () => {
      alive = false;
      // Textures live on the graphics card and are not garbage collected, so
      // they have to be handed back explicitly.
      for (const texture of mine) texture.dispose();
      setLoaded({});
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return loaded;
}
