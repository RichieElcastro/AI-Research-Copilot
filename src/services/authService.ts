import { User } from '../types';
import { storage } from './storage';

const USERS_KEY = 'users';
const CURRENT_USER_KEY = 'current_user';

// Default initial users for academic testing & user isolation validation
const DEFAULT_USERS: User[] = [
  {
    id: 'usr_amelia_ross',
    name: 'Dr. Amelia Ross',
    email: 'dr.amelia@research.edu',
    institution: 'Department of Behavioral Sciences, National Institute of Research',
    role: 'researcher',
    createdAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'usr_kenji_sato',
    name: 'Kenji Sato, M.Sc.',
    email: 'kenji.sato@university.edu',
    institution: 'Graduate School of Education & Psychology, Metropolitan University',
    role: 'student',
    createdAt: '2026-02-01T09:30:00.000Z',
  },
];

export const authService = {
  getUsers(): User[] {
    const existing = storage.get<User[]>(USERS_KEY, []);
    if (existing.length === 0) {
      storage.set(USERS_KEY, DEFAULT_USERS);
      return DEFAULT_USERS;
    }
    return existing;
  },

  getCurrentUser(): User | null {
    const user = storage.get<User | null>(CURRENT_USER_KEY, null);
    if (!user) {
      // Default to Dr. Amelia on first launch for a frictionless experience
      const users = this.getUsers();
      if (users.length > 0) {
        this.setCurrentUser(users[0]);
        return users[0];
      }
    }
    return user;
  },

  setCurrentUser(user: User | null): void {
    if (user) {
      storage.set(CURRENT_USER_KEY, user);
    } else {
      storage.remove(CURRENT_USER_KEY);
    }
  },

  login(email: string): { success: boolean; user?: User; error?: string } {
    const users = this.getUsers();
    const found = users.find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (!found) {
      return { success: false, error: 'User with this institutional email was not found.' };
    }
    this.setCurrentUser(found);
    return { success: true, user: found };
  },

  register(userData: {
    name: string;
    email: string;
    institution?: string;
    role: User['role'];
  }): { success: boolean; user?: User; error?: string } {
    const users = this.getUsers();
    const existing = users.find(u => u.email.toLowerCase().trim() === userData.email.toLowerCase().trim());
    if (existing) {
      return { success: false, error: 'An account with this institutional email already exists.' };
    }

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: userData.name.trim(),
      email: userData.email.toLowerCase().trim(),
      institution: userData.institution?.trim() || 'Academic Institution',
      role: userData.role,
      createdAt: new Date().toISOString(),
    };

    const updated = [...users, newUser];
    storage.set(USERS_KEY, updated);
    this.setCurrentUser(newUser);
    return { success: true, user: newUser };
  },

  logout(): void {
    this.setCurrentUser(null);
  },

  switchUser(userId: string): { success: boolean; user?: User; error?: string } {
    const users = this.getUsers();
    const target = users.find(u => u.id === userId);
    if (!target) {
      return { success: false, error: 'Target user not found.' };
    }
    this.setCurrentUser(target);
    return { success: true, user: target };
  },
};
