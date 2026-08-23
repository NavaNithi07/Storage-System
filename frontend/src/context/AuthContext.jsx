import { createContext } from 'react';

// Auth shape:
// { user, login(email,password), register(name,email,password), logout, loading, updateUser, loginWithGoogle }
export const AuthContext = createContext({
  user: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  loading: false,
  updateUser: () => {},
  loginWithGoogle: async () => {},
});






