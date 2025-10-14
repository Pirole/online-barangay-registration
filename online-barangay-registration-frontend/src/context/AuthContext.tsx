import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "EVENT_MANAGER" | "STAFF" | string;
  barangay?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  userRole: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 🔄 Restore session on mount
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
        localStorage.removeItem("user_role");
      }
    }

    setIsLoading(false);
  }, []);

  // 🔐 Login handler — patched for both response shapes
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch("http://localhost:5000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      // ✅ Handle both backend shapes
      const userDataRaw = data.user || data.data?.user;
      const tokenData = data.token || data.data?.token;

      if (!userDataRaw || !tokenData) {
        console.error("Invalid backend response:", data);
        throw new Error("Invalid server response — missing user or token");
      }

      // ✅ Normalize role safely
      const normalizedRole =
        typeof userDataRaw.role === "string"
          ? userDataRaw.role.toLowerCase()
          : "staff";

      const userData: User = {
        ...userDataRaw,
        role: normalizedRole,
      };

      // ✅ Update state and persist
      setUser(userData);
      setToken(tokenData);
      localStorage.setItem("auth_token", tokenData);
      localStorage.setItem("auth_user", JSON.stringify(userData));
      localStorage.setItem("user_role", normalizedRole);

      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
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

  // 🧠 Derived helpers
  const isAuthenticated = !!user && !!token;
  const userRole = user?.role || localStorage.getItem("user_role");
  const hasRole = (roles: string[]): boolean =>
    userRole ? roles.includes(userRole) : false;

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

// 🔧 Hook
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
