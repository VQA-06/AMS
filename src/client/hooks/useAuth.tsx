import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Admin } from '@/shared/types';
import { fetchApi } from '../lib/api-client';

interface AuthContextType {
  admin: Admin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithQr: (qrToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (data: {
    name?: string;
    email?: string;
    current_password?: string;
    new_password?: string;
  }) => Promise<Admin>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read cached admin from localStorage on first mount
  const [admin, setAdmin] = useState<Admin | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('ams_admin');
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('ams_session_token');
    }
    return true;
  });

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApi<{ admin: Admin }>('/api/auth/me');
      setAdmin(data.admin);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ams_admin', JSON.stringify(data.admin));
      }
    } catch {
      setAdmin(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ams_admin');
        localStorage.removeItem('ams_session_token');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await fetchApi<{ admin: Admin; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setAdmin(res.admin);
    if (typeof window !== 'undefined') {
      if (res.token) {
        localStorage.setItem('ams_session_token', res.token);
      }
      localStorage.setItem('ams_admin', JSON.stringify(res.admin));
    }
  };

  const loginWithQr = async (qrToken: string) => {
    const res = await fetchApi<{ admin: Admin; token?: string }>('/api/auth/login-qr', {
      method: 'POST',
      body: JSON.stringify({ qr: qrToken }),
    });

    setAdmin(res.admin);
    if (typeof window !== 'undefined') {
      if (res.token) {
        localStorage.setItem('ams_session_token', res.token);
      }
      localStorage.setItem('ams_admin', JSON.stringify(res.admin));
    }
  };

  const updateProfile = async (data: {
    name?: string;
    email?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<Admin> => {
    const res = await fetchApi<{ admin: Admin }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    setAdmin(res.admin);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ams_admin', JSON.stringify(res.admin));
    }
    return res.admin;
  };

  const logout = async () => {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      setAdmin(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ams_admin');
        localStorage.removeItem('ams_session_token');
      }
    }
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, loginWithQr, logout, refresh, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
