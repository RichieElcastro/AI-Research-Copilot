import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  login: (email: string) => { success: boolean; error?: string };
  register: (data: { name: string; email: string; institution?: string; role: User['role'] }) => {
    success: boolean;
    error?: string;
  };
  logout: () => void;
  switchUser: (userId: string) => { success: boolean; error?: string };
  refreshUsers: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getCurrentUser());
  const [users, setUsers] = useState<User[]>(() => authService.getUsers());

  const refreshUsers = () => {
    setUsers(authService.getUsers());
  };

  const login = (email: string) => {
    const res = authService.login(email);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      refreshUsers();
      return { success: true };
    }
    return { success: false, error: res.error || 'Login failed' };
  };

  const register = (data: { name: string; email: string; institution?: string; role: User['role'] }) => {
    const res = authService.register(data);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      refreshUsers();
      return { success: true };
    }
    return { success: false, error: res.error || 'Registration failed' };
  };

  const logout = () => {
    authService.logout();
    setCurrentUser(null);
  };

  const switchUser = (userId: string) => {
    const res = authService.switchUser(userId);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  useEffect(() => {
    const active = authService.getCurrentUser();
    if (active && (!currentUser || currentUser.id !== active.id)) {
      setCurrentUser(active);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        login,
        register,
        logout,
        switchUser,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
