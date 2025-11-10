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

  // Set mounted state after hydration to prevent server/client mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const allNavItems = [
    { href: '/', label: 'Home' },
    { href: '/deposit', label: 'Deposit' },
    { href: '/transfer', label: 'Transfer' },
    { href: '/withdraw', label: 'Withdraw' },
  ];

  // Only show Home if user is not registered, show all items if registered
  const navItems = isRegistered ? allNavItems : [allNavItems[0]];

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold">
                zkWallet
              </Link>
              <div className="hidden md:flex gap-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? 'bg-black text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <WalletStatus />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="border-t border-black mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-sm text-gray-600 text-center">
            Privacy-preserving wallet on Arbitrum Stylus
          </p>
        </div>
      </footer>
    </div>
  );
}
