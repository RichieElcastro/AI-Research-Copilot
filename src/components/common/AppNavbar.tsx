import React, { useState } from 'react';
import { FlaskConical, ShieldCheck, ShieldAlert, FolderKanban } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserMenu } from '../auth/UserMenu';
import { AuthModal } from '../auth/AuthModal';
import { SecurityTestModal } from '../projects/SecurityTestModal';

interface AppNavbarProps {
  onNavigateHome: () => void;
  activeProjectTitle?: string | null;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  onNavigateHome,
  activeProjectTitle,
}) => {
  const { currentUser } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div
            onClick={onNavigateHome}
            className="flex items-center space-x-3 cursor-pointer group select-none"
            id="brand-navigation-home"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold tracking-wider shadow-xs group-hover:bg-indigo-900 transition-colors">
              <FlaskConical className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight group-hover:text-indigo-600 transition-colors">
                  Quantitative Research Platform
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-slate-200">
                  Phase 1 Core
                </span>
              </div>
              <p className="text-xs text-slate-700 truncate max-w-xs sm:max-w-sm">
                {activeProjectTitle ? `Workspace: ${activeProjectTitle}` : 'Empirical Research & Operationalization Studio'}
              </p>
            </div>
          </div>

          {/* Right Action & User Isolation Controls */}
          <div className="flex items-center space-x-3">
            {/* Integrity Badge */}
            <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Data Integrity & Audit Lineage</span>
            </div>

            {/* Security Isolation Test Button */}
            <button
              type="button"
              id="navbar-btn-security-test"
              onClick={() => setIsSecurityModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-2xs"
              title="Execute security authorization tests to verify isolation against other researchers"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Security Audit</span>
            </button>

            {/* Back to Project Directory Button if inside a project */}
            {activeProjectTitle && (
              <button
                type="button"
                id="navbar-btn-projects"
                onClick={onNavigateHome}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title="View All Projects"
              >
                <FolderKanban className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Projects</span>
              </button>
            )}

            {/* Authenticated User Menu */}
            <UserMenu
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onOpenSecurityTest={() => setIsSecurityModalOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Security Penetration Modal */}
      <SecurityTestModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />
    </header>
  );
};
