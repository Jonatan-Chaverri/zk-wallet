/**
 * Detect if the current device is a mobile device
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent || window.navigator.vendor || (window as any).opera;
  
  // Check for mobile devices
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  return mobileRegex.test(userAgent);
}

/**
 * Detect if MetaMask is installed (only works on desktop)
 */
export function isMetaMaskInstalled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return !!(window as any).ethereum && (window as any).ethereum.isMetaMask;
}

/**
 * Open MetaMask app on mobile using deep link
 * Uses MetaMask's universal link format for better compatibility
 */
export function openMetaMaskMobile(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const currentUrl = window.location.href;
  
  // Use MetaMask's universal link format
  // This works better across different mobile platforms
  const universalLink = `https://metamask.app.link/dapp/${encodeURIComponent(currentUrl)}`;
  
  // Try to open in new window/tab
  const opened = window.open(universalLink, '_blank');
  
  // If popup was blocked, try direct navigation
  if (!opened || opened.closed || typeof opened.closed === 'undefined') {
    // Fallback: try direct deep link
    const deepLink = `metamask://wc?uri=${encodeURIComponent(currentUrl)}`;
    window.location.href = deepLink;
  }
}

/**
 * Check if we're in MetaMask's in-app browser
 */
export function isInMetaMaskBrowser(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  const userAgent = window.navigator.userAgent || '';
  return /MetaMaskMobile/i.test(userAgent) || !!(window as any).ethereum;
}

