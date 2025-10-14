// src/components/layout/AuthGuard.tsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * AuthGuard: wraps a route element and allows access only if user exists and role is allowed.
 * props.roles: string[] of allowed roles (e.g. ['SUPER_ADMIN','EVENT_MANAGER'])
 */
const AuthGuard: React.FC<{ roles?: string[]; children: React.ReactElement }> = ({ roles, children }) => {
  const { user } = useAuth() as any; // keep flexible if your AuthContext shape differs

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0 && !roles.includes((user.role || "").toUpperCase())) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AuthGuard;
