import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
  const { user, authChecked } = useAuth();

  // Wait until we've verified the real session (httpOnly cookie) before
  // deciding anything — otherwise a stale/missing localStorage value could
  // briefly redirect a genuinely logged-in user, or vice versa.
  if (!authChecked) {
    return null;
  }

  if (!user) {
    // Redirect unauthenticated users to the sign-in page
    return <Navigate to="/signin" replace />;
  }

  return children ? children : <Outlet />;
}

export default ProtectedRoute;
