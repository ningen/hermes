import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as authService from '../services/auth';
import * as emailRouteService from '../services/route';
import { EmailRoute } from '../services/route';

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  emailRoute: EmailRoute | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [emailRoute, setEmailRoute] = useState<EmailRoute | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('token');
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          const userData = await authService.getMe(savedToken);
          const emailRoute = await emailRouteService.getEmailRoute(savedToken);
          setUser(userData.user);
          setToken(savedToken);
          setEmailRoute(emailRoute);
        } catch (err) {
          console.error('Failed to restore session:', err);
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    const emailRoute = await emailRouteService.getEmailRoute(response.token);
    setUser(response.user);
    setToken(response.token);
    setEmailRoute(emailRoute);
    localStorage.setItem('token', response.token);
  };

  const register = async (email: string, password: string, name?: string) => {
    const response = await authService.register(email, password, name);
    const emailRoute = await emailRouteService.getEmailRoute(response.token);
    setUser(response.user);
    setToken(response.token);
    setEmailRoute(emailRoute)
    localStorage.setItem('token', response.token);
  };

  const logout = async () => {
    if (token) {
      try {
        await authService.logout(token);
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    setUser(null);
    setToken(null);
    setEmailRoute(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, emailRoute, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
