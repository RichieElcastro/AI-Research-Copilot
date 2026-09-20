import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Users, ShieldAlert, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface UserMenuProps {
  onOpenAuth: () => void;
  onOpenSecurityTest: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ onOpenAuth, onOpenSecurityTest }) => {
  const { currentUser, users, logout, switchUser } = useAuth();
  const { success, info } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentUser) {
    return (
      <button
        type="button"
        id="btn-login-trigger"
        onClick={onOpenAuth}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
      >
        <User className="w-3.5 h-3.5" />
        Sign In / Register
      </button>
    );
  }

  const handleSwitch = (userId: string, userName: string) => {
    switchUser(userId);
    setIsOpen(false);
    success('User Session Switched', `Now operating as ${userName}. Project data is strictly isolated.`);
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    info('Logged Out', 'You have been safely signed out from the research workspace.');
  };

  return (
    <div className="relative" ref={menuRef} id="user-menu-dropdown-container">
      <button
        type="button"
        id="btn-user-profile-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-2xs text-left"
      >
        <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
          {currentUser.name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')}
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold text-slate-800 line-clamp-1">{currentUser.name}</p>
          <p className="text-[10px] text-slate-500 capitalize">{currentUser.role}</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
      </button>

      {isOpen && (
        <div
          id="user-menu-popover"
          className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* User details header */}
          <div className="px-4 py-2.5 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-900">{currentUser.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
            {currentUser.institution && (
              <p className="text-[10px] text-slate-600 mt-1 line-clamp-2 leading-tight">
                🏛️ {currentUser.institution}
              </p>
            )}
            <div className="mt-2">
              <span className="inline-block text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Authenticated {currentUser.role}
              </span>
            </div>
          </div>

          {/* User isolation quick-switch (for testing cross-account isolation) */}
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Users className="w-3 h-3" /> Switch Researcher Account
            </p>
            <div className="space-y-1">
              {users.map(u => (
                <button
                  key={u.id}
                  type="button"
                  id={`btn-switch-user-${u.id}`}
                  onClick={() => handleSwitch(u.id, u.name)}
                  className={`w-full flex items-center justify-between p-1.5 rounded text-left text-xs transition-colors ${
                    u.id === currentUser.id
                      ? 'bg-indigo-50 text-indigo-900 font-medium'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="truncate">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{u.role}</p>
                  </div>
                  {u.id === currentUser.id && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Security Test trigger */}
          <div className="p-1 border-b border-slate-100">
            <button
              type="button"
              id="btn-test-security-isolation"
              onClick={() => {
                setIsOpen(false);
                onOpenSecurityTest();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 rounded-lg transition-colors font-medium"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Verify Security & Cross-Access Isolation
            </button>
          </div>

          {/* Logout */}
          <div className="p-1">
            <button
              type="button"
              id="btn-user-logout"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50 rounded-lg transition-colors font-medium"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
