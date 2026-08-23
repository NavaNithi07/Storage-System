const isTokenExpired = (token) => {
  try {
    // JWT payload is the second segment, base64url encoded
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is in seconds, Date.now() is in ms
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true; // Treat malformed tokens as expired
  }
};

export const getInitialUser = () => {
  const token = localStorage.getItem('token');
  const userInfoRaw = localStorage.getItem('userInfo');

  // Clear everything if no token
  if (!token) {
    if (userInfoRaw) localStorage.removeItem('userInfo');
    return null;
  }

  // Clear everything if the token is expired — prevents stale admin sessions
  if (isTokenExpired(token)) {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('refreshToken');
    return null;
  }

  if (!userInfoRaw) return null;

  try {
    const user = JSON.parse(userInfoRaw);
    // Sanity check: role must be 'user' or 'admin', nothing else
    if (!user.role || !['user', 'admin'].includes(user.role)) {
      user.role = 'user';
    }
    return user;
  } catch {
    // If localStorage is corrupted, clear it
    localStorage.removeItem('userInfo');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    return null;
  }
};
