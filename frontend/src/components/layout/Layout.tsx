import React, { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, emailRoute, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium px-3 py-2 rounded-md ${
      isActive
        ? 'text-indigo-600 bg-indigo-50'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`;

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block text-sm font-medium px-4 py-3 ${
      isActive
        ? 'text-indigo-600 bg-indigo-50'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
    }`;

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left: Logo + Desktop Nav */}
            <div className="flex items-center gap-6">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Hermes</h1>
              </div>
              {/* Desktop nav links */}
              <div className="hidden sm:flex items-center gap-1">
                <NavLink to="/workflows" className={navLinkClass}>
                  ワークフロー
                </NavLink>
                <NavLink to="/transcriptions" className={navLinkClass}>
                  文字起こし
                </NavLink>
                <NavLink to="/logs" className={navLinkClass}>
                  ログ
                </NavLink>
                <NavLink to="/settings" className={navLinkClass}>
                  設定
                </NavLink>
                <NavLink to="/onboarding" className={navLinkClass}>
                  使い方
                </NavLink>
              </div>
            </div>

            {/* Right: Desktop user info + Mobile hamburger */}
            <div className="flex items-center gap-2">
              {/* Desktop user info + logout */}
              {user && (
                <>
                  <span className="hidden sm:inline text-sm text-gray-700 max-w-xs truncate">
                    {user.name || user.email}{emailRoute && ` (${emailRoute.emailAddress})`}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="hidden sm:inline px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Logout
                  </button>
                </>
              )}

              {/* Mobile hamburger button */}
              <button
                className="sm:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="メニューを開閉"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-200">
            <div className="divide-y divide-gray-100">
              <NavLink to="/workflows" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                ワークフロー
              </NavLink>
              <NavLink to="/transcriptions" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                文字起こし
              </NavLink>
              <NavLink to="/logs" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                ログ
              </NavLink>
              <NavLink to="/settings" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                設定
              </NavLink>
              <NavLink to="/onboarding" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                使い方
              </NavLink>
            </div>
            {user && (
              <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-700 truncate">{user.name || user.email}</span>
                <button
                  onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 ml-4 flex-shrink-0"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow px-5 py-6 sm:px-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
