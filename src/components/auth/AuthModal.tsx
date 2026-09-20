import React, { useState } from 'react';
import { UserPlus, LogIn, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { UserRole } from '../../types';
import { Modal } from '../common/Modal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, users } = useAuth();
  const { success, error } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [role, setRole] = useState<UserRole>('researcher');
  const [formError, setFormError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email.trim()) {
      setFormError('Institutional email is required.');
      return;
    }

    const res = login(email);
    if (res.success) {
      success('Authentication Successful', `Welcome back to the research workspace.`);
      onClose();
    } else {
      setFormError(res.error || 'User not found. Try one of the demo researcher accounts or register.');
      error('Sign-in Failed', res.error);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Researcher full name is required.');
      return;
    }
    if (!email.trim()) {
      setFormError('Institutional email address is required.');
      return;
    }

    const res = register({ name, email, institution, role });
    if (res.success) {
      success('Account Created', `Authenticated workspace initialized for ${name}.`);
      onClose();
    } else {
      setFormError(res.error || 'Failed to create account.');
      error('Registration Failed', res.error);
    }
  };

  const fillQuickAccount = (quickEmail: string) => {
    setEmail(quickEmail);
    const res = login(quickEmail);
    if (res.success) {
      success('Signed in', `Loaded profile for ${quickEmail}`);
      onClose();
    }
  };

  return (
    <Modal
      id="auth-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'login' ? 'Researcher Authentication' : 'Create Researcher Account'}
      subtitle="Access your strictly isolated research projects and variable hierarchies"
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Toggle Mode */}
        <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setFormError(null);
            }}
            className={`flex-1 py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              mode === 'login' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" /> Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setFormError(null);
            }}
            className={`flex-1 py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              mode === 'register' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" /> Register New Account
          </button>
        </div>

        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 leading-relaxed font-medium">
            {formError}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label htmlFor="auth-login-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Institutional Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="auth-login-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. dr.amelia@research.edu"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
              />
            </div>

            <button
              type="submit"
              id="btn-submit-login"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5" /> Authenticate & Access Workspace
            </button>

            {/* Quick Demo Logins */}
            <div className="pt-3 border-t border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 mb-2">Pre-registered Researcher Profiles:</p>
              <div className="space-y-1.5">
                {users.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => fillQuickAccount(u.email)}
                    className="w-full text-left p-2 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{u.name}</p>
                      <p className="text-[10px] text-slate-500">{u.email}</p>
                    </div>
                    <span className="text-[10px] text-indigo-700 font-medium capitalize px-2 py-0.5 bg-indigo-50 rounded">
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name & Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Dr. Jane Smith, Ph.D."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Institutional Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. jane.smith@university.edu"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="reg-institution" className="block text-xs font-semibold text-slate-700 mb-1">
                University or Research Institution
              </label>
              <input
                id="reg-institution"
                type="text"
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                placeholder="e.g. Faculty of Psychology, University of Research"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="reg-role" className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Role
              </label>
              <select
                id="reg-role"
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
              >
                <option value="researcher">Principal Investigator / Faculty Researcher</option>
                <option value="student">Postgraduate / Undergraduate Student</option>
                <option value="faculty">Academic Advisor / Faculty Mentor</option>
                <option value="reviewer">Methodology / Ethics Reviewer</option>
              </select>
            </div>

            <button
              type="submit"
              id="btn-submit-register"
              className="w-full py-2 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus className="w-3.5 h-3.5" /> Register & Begin Research
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
};
