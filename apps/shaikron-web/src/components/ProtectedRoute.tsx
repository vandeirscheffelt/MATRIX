import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const NEW_USER_ALLOWED_PATHS = ["/", "/agenda", "/conversations", "/settings", "/account", "/modules", "/products"];

const matchesAllowedPath = (pathname: string) =>
  NEW_USER_ALLOWED_PATHS.some((allowedPath) =>
    allowedPath === "/"
      ? pathname === allowedPath
      : pathname === allowedPath || pathname.startsWith(`${allowedPath}/`)
  );

export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { isLoggedIn, isNewUser, isAdmin } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (isNewUser && !isAdmin) {
    if (!matchesAllowedPath(location.pathname)) {
      return <Navigate to="/settings" replace />;
    }
  }

  return <>{children}</>;
}
