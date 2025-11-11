// Browser polyfills for Node.js APIs required by @aztec/bb.js
// This file is imported in the root layout to ensure Buffer is available globally

import { Buffer } from 'buffer/';

// Make Buffer available globally in the browser
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
