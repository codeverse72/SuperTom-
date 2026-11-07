import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AdminUser, AdminRole } from '../types/admin';
import { adminApi } from '../services/adminApiClient';

interface AdminAuthContextType {
  admin: AdminUser | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasRole: (roles: AdminRole[]) => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async () => {
    if (!adminApi.isAuthenticated()) {
      setIsLoading(false);
      return;
    }

    const res = await adminApi.getProfile();
    if (res.success && res.data) {
      setAdmin(res.data);
    } else {
      adminApi.logout();
      setAdmin(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();

    const handleExpired = () => {
      setAdmin(null);
    };

    window.addEventListener('admin_auth_expired', handleExpired);
    return () => window.removeEventListener('admin_auth_expired', handleExpired);
  }, [fetchProfile]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    const res = await adminApi.login(email, pass);
    setIsLoading(false);
    if (res.success && res.data?.admin) {
      setAdmin(res.data.admin);
      return { success: true };
    }
    return { success: false, error: res.error || 'Login failed' };
  };

  const logout = () => {
    adminApi.logout();
    setAdmin(null);
  };

  const hasRole = (roles: AdminRole[]): boolean => {
    if (!admin) return false;
    return roles.includes(admin.role);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, isLoading, login, logout, hasRole }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

