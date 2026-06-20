import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('omnichat_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // True until we've checked the real session (httpOnly cookie) at least once.
  // Pages that depend on "who is logged in" (like Chats) should wait for this
  // before trusting `user`, since the cookie — not localStorage — is the only
  // thing that's truly scoped to this specific browser/session.
  const [authChecked, setAuthChecked] = useState(false);

  // On every fresh load (including refresh), ask the server who the
  // httpOnly cookie actually belongs to, and correct localStorage/state
  // if it disagrees (e.g. localStorage was stale, or shared between two
  // windows of the same browser profile logged in as different users).
  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await api.get('/auth/me');
        const responseData = response.data.data;
        const verifiedUser = {
          id: responseData.id,
          userName: responseData.userName,
          email: responseData.email,
        };
        setUser(verifiedUser);
        localStorage.setItem('omnichat_user', JSON.stringify(verifiedUser));
      } catch {
        // No valid cookie/session on this browser -> definitely logged out,
        // regardless of what localStorage might have said.
        setUser(null);
        localStorage.removeItem('omnichat_user');
        localStorage.removeItem('omnichat_token');
      } finally {
        setAuthChecked(true);
      }
    };
    verifySession();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/signin', { email, password });
      const responseData = response.data.data;
      const userData = {
        id: responseData.id,
        userName: responseData.userName || responseData.name,
        email: responseData.email
      };
      setUser(userData);
      localStorage.setItem('omnichat_user', JSON.stringify(userData));
      if (responseData.token) {
        // Stored alongside the cookie as a fallback auth path — see api.js.
        localStorage.setItem('omnichat_token', responseData.token);
      }
      setAuthChecked(true);
      setLoading(false);
      return { success: true };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Invalid email or password';
      setError(errMsg);
      setLoading(false);
      return { success: false, message: errMsg };
    }
  };

  const signup = async (userName, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/signup', { userName, email, password });
      setLoading(false);
      return { success: true, message: response.data.message };
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Registration failed';
      setError(errMsg);
      setLoading(false);
      return { success: false, message: errMsg };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      setUser(null);
      localStorage.removeItem('omnichat_user');
      localStorage.removeItem('omnichat_token');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, authChecked, login, signup, logout, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
