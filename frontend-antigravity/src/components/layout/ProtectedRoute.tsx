import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const token = localStorage.getItem('token');
  let currentUser = null;
  try {
    const userStr = localStorage.getItem('user');
    currentUser = userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    console.error('Error parsing user data:', e);
  }

  if (!token || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(currentUser.role)) {
      // Si el usuario no tiene permiso, lo enviamos al dashboard principal
      // CUIDADO: El dashboard principal ("/") no tiene 'allowedRoles', por lo que no causará loop.
      return <Navigate to="/" replace />; 
    }
  }

  return <Outlet />;
};
