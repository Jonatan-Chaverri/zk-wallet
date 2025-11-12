'use client';

import { useEffect } from 'react';

/**
 * Client-side polyfills loader
 * Loads Buffer polyfill only in the browser to avoid SSR issues
 */
export function PolyfillsLoader() {
  useEffect(() => {
    // Dynamically import Buffer polyfill only in browser
    import('buffer/').then(({ Buffer }) => {
      if (typeof window !== 'undefined') {
        // @ts-expect-error - Buffer polyfill for browser
        window.Buffer = Buffer;
        // @ts-expect-error - Buffer polyfill for browser
        globalThis.Buffer = Buffer;
        // @ts-expect-error - Buffer polyfill for browser
        global.Buffer = Buffer;
      }
      
      // Ensure Buffer is available immediately
      if (typeof globalThis.Buffer === 'undefined') {
        // @ts-expect-error - Buffer polyfill for browser
        globalThis.Buffer = Buffer;
      }
    });
  }, []);

  return null; // This component doesn't render anything
}

