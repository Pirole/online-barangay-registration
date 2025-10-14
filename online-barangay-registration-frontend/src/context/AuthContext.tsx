// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "event_manager" | "staff";
  barangay?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  userRole: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session
  useEffect(() => {
    const savedToken = localStorage.getItem("auth_token");
    const savedUser = localStorage.getItem("auth_user");

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
      } catch (err) {
        console.error("⚠️ Failed to parse saved user:", err);
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
      }
    }

    setIsLoading(false);
  }, []);

  // 🔐 Login handler
  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Invalid email or password");
      }

      const data = await response.json();

      // Normalize role to lowercase
      const userData: User = {
        ...data.user,
        role: data.user.role.toLowerCase(),
      };

      setUser(userData);
      setToken(data.token);

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(userData));
      localStorage.setItem("user_role", userData.role);

      console.log(`✅ Logged in as ${userData.role}`);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 🚪 Logout handler
  const logout = (): void => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("user_role");

    if (token) {
      fetch("http://localhost:5000/api/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  };

  const isAuthenticated = !!user && !!token;
  const userRole = user?.role || localStorage.getItem("user_role");
  const hasRole = (roles: string[]): boolean => (userRole ? roles.includes(userRole) : false);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    userRole,
    login,
    logout,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
