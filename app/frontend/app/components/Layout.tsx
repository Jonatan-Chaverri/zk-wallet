'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletStatus } from './WalletStatus';

const USERNAME_STORAGE_KEY = 'zk-wallet-username';

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Set mounted state after hydration to prevent server/client mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle scroll-based background color transition
  useEffect(() => {
    if (!isMounted) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      // Calculate progress: 0 at top, 1 after scrolling 200px
      // Adjust the 200px value to control how fast the transition happens
      const maxScroll = 200;
      const progress = Math.min(scrollY / maxScroll, 1);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isMounted]);

  // Check localStorage for username on mount and when it changes
  useEffect(() => {
    if (!isMounted) return;

    const checkRegistration = () => {
      const username = localStorage.getItem(USERNAME_STORAGE_KEY);
      setIsRegistered(!!username);
    };

    checkRegistration();

    // Listen for custom event when localStorage changes in same window
    const handleStorageChange = () => {
      checkRegistration();
    };

    // Listen for storage events from other tabs/windows
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === USERNAME_STORAGE_KEY) {
        checkRegistration();
      }
    };

    window.addEventListener('username-storage-changed', handleStorageChange);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('username-storage-changed', handleStorageChange);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [isMounted]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const allNavItems = [
    { href: '/', label: 'Home' },
    { href: '/deposit', label: 'Deposit' },
    { href: '/transfer', label: 'Transfer' },
    { href: '/withdraw', label: 'Withdraw' },
  ];

  // Only show Home if user is not registered, show all items if registered
  const navItems = isRegistered ? allNavItems : [allNavItems[0]];

  // Calculate background color based on scroll progress
  // Interpolate between bg-black/80 (0% opacity) and bg-brand-purple-dark (100% opacity)
  // brand-purple-dark: #4C1D95 = rgb(76, 29, 149)
  const navBgOpacity = scrollProgress;
  
  // Blend between black (rgba(0, 0, 0, 0.8)) and brand-purple-dark (rgb(76, 29, 149))
  const blackR = 0, blackG = 0, blackB = 0, blackA = 0.8;
  const purpleR = 76, purpleG = 29, purpleB = 149;
  
  // Interpolate RGB values
  const r = Math.round(blackR + (purpleR - blackR) * navBgOpacity);
  const g = Math.round(blackG + (purpleG - blackG) * navBgOpacity);
  const b = Math.round(blackB + (purpleB - blackB) * navBgOpacity);
  // Interpolate alpha: start at 0.8, end at 1.0
  const a = blackA + (1 - blackA) * navBgOpacity;
  
  const navBgStyle = {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${a})`,
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-black bg-gradient-purple relative">
      <nav 
        className="sticky top-0 backdrop-blur-sm z-50 transition-all duration-300 ease-out"
        style={navBgStyle}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold text-white hover:text-brand-purple transition-colors">
                zkWallet
              </Link>
              <div className="hidden md:flex gap-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? 'bg-brand-purple text-white'
                        : 'text-white hover:bg-brand-purple'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <WalletStatus />
              {/* Hamburger menu button - visible on mobile, hidden on md+ */}
              <button
                onClick={toggleMobileMenu}
                className="md:hidden p-2 rounded-lg text-white hover:bg-brand-purple transition-colors focus:outline-none focus:ring-2 focus:ring-brand-purple"
                aria-label="Toggle menu"
                aria-expanded={isMobileMenuOpen}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isMobileMenuOpen ? (
                    <path d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={closeMobileMenu}
          />
          {/* Mobile menu */}
          <div
            className="fixed top-16 left-0 right-0 z-40 md:hidden transition-all duration-300 ease-out"
            style={navBgStyle}
          >
            <div className="px-4 py-4 space-y-2 border-t border-white/10">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-brand-purple text-white'
                      : 'text-white hover:bg-brand-purple'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {children}
      </main>

      <footer className="border-t border-white mt-16 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-sm text-white text-center">
            © 2025 zkWallet — Built as a public good for the Invisible Garden Hackathon. Licensed under the MIT License.
          </p>
        </div>
      </footer>
    </div>
  );
}
