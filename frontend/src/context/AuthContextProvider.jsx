import { useState, useEffect } from 'react';
import api from '../services/api';
import { AuthContext } from './AuthContext';
import { getInitialUser } from './authUtils';

export default function AuthContextProvider({ children }) {
  const [user, setUser] = useState(getInitialUser);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initialUser = getInitialUser();
    setUser(initialUser);
    setLoading(false);
  }, []);

  const persistAuth = (data) => {
    localStorage.setItem('userInfo', JSON.stringify(data));
    localStorage.setItem('token', data.token);
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    setUser(data);
  };

  const login = async (identifier, password) => {
    // Backend expects: { identifier, password }
    // If password is missing, fail fast with the same error message.
    if (!identifier || !password) {
      throw new Error('Email/username and password are required');
    }

    try {
      const res = await api.post('/auth/login', { identifier, password });
      persistAuth(res.data);
      return res.data;
    } catch (error) {
      // Log network errors for debugging
      if (!error.response) {
        console.error('[AuthContext] Network error on login:', error.message);
      }
      throw error;
    }
  };

  const register = async (name, email, mobile, password) => {
    try {
      const res = await api.post('/auth/register', { name, email, mobile, password });
      persistAuth(res.data);
      return res.data;
    } catch (error) {
      // Log network errors for debugging
      if (!error.response) {
        console.error('[AuthContext] Network error on register:', error.message);
      }
      throw error;
    }
  };

  const loginWithGoogle = async (idToken, isSignUp = false, confirmLinking = false) => {
    if (!idToken) throw new Error('Firebase ID token is required');
    try {
      const res = await api.post('/auth/google', { idToken, isSignUp, confirmLinking });
      persistAuth(res.data);
      return res.data;
    } catch (err) {
      const responseData = err?.response?.data;
      if (!err.response) {
        console.error('[AuthContext] Network error on Google login:', err.message);
      } else {
        console.error('[AuthContext] Google login response error:', responseData || err.message || err);
      }
      throw err;
    }
  };

  const registerVibnaAccount = async (formData) => {
    try {
      const res = await api.post('/auth/register-vibna', formData);
      persistAuth(res.data);
      return res.data;
    } catch (error) {
      if (!error.response) {
        console.error('[AuthContext] Network error on Vibna registration:', error.message);
      }
      throw error;
    }
  };

  const logout = async () => {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await api.post('/auth/logout', { token, refreshToken });
    } catch (e) {
      console.warn('Logout request failed', e.message);
    }
    localStorage.removeItem('userInfo');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const updateUser = (updatedUserData) => {
    const userInfoRaw = localStorage.getItem('userInfo');
    if (userInfoRaw) {
      try {
        const userInfo = JSON.parse(userInfoRaw);
        const newUserInfo = { ...userInfo, ...updatedUserData };
        localStorage.setItem('userInfo', JSON.stringify(newUserInfo));
        if (updatedUserData.token) {
          localStorage.setItem('token', updatedUserData.token);
        }
        setUser(newUserInfo);
      } catch (err) {
        console.error("Failed to update user profile in context", err);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, updateUser, loginWithGoogle, registerVibnaAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

