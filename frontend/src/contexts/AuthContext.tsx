import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  enabled: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  needsSetup: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  checkSetup: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const navigate = useNavigate();

  const checkSetup = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/setup`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setNeedsSetup(data.needs_setup);
        return data.needs_setup;
      }
    } catch (error) {
      console.error('Setup check failed:', error);
    }
    return false;
  };

  const checkAuth = async () => {
    try {
      const setupNeeded = await checkSetup();
      if (setupNeeded) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    setUser(data.user);
    navigate('/');
  };

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      navigate('/login');
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, login, logout, checkAuth, checkSetup }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
