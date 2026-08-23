# Dashboard Access Control - Testing Guide

## Quick Testing Checklist

### Prerequisites
- Backend running on `http://localhost:5000`
- Frontend running on `http://localhost:5173`
- Database connected

### Test 1: Regular User Registration & Login
```
1. Go to http://localhost:5173/register
2. Register with:
   - Name: Test User
   - Email: testuser@example.com
   - Password: TestPass123!
3. After registration, should automatically redirect to /my-files
4. Verify sidebar shows: My Files, History, Favorites, Trash, Settings
5. Verify you see the file management UI
```

### Test 2: Regular User Cannot Access Admin Dashboard
```
1. As the regular user from Test 1
2. Try to navigate directly to http://localhost:5173/admin/dashboard
3. Should be redirected immediately to /my-files
4. Check browser console for navigation logs
5. No error messages should appear
```

### Test 3: Admin User Login
```
1. Go to http://localhost:5173/login
2. Login with:
   - Email: admin@gmail.com
   - Password: 789654
3. After login, should automatically redirect to /admin/dashboard
4. Verify sidebar shows: Admin Dashboard only
5. Verify you see admin statistics and user management
```

### Test 4: Admin User Cannot Access Regular Dashboard as Default
```
1. As the admin user from Test 3
2. Try to navigate directly to http://localhost:5173/my-files
3. Should still be able to access it (by design, for debugging)
4. But sidebar should still show "Admin Dashboard" option
5. Click "Admin Dashboard" from sidebar to return
```

### Test 5: Logout and Re-login Flow
```
1. Logout (click logout button in dropdown)
2. Should redirect to /login
3. Try accessing /my-files → redirects to /login
4. Try accessing /admin/dashboard → redirects to /login
5. Login again as regular user
6. Should redirect to /my-files
```

### Test 6: Network Error Handling
```
1. Stop the backend server
2. Go to /login
3. Try to login with any credentials
4. Should show: "Network error: Unable to connect to server..."
5. Check browser console (F12 → Console) for [API] logs
6. Restart backend
7. Login should work again
```

### Test 7: Multiple Browser Tabs
```
1. Open Tab 1: Login as regular user to http://localhost:5173/login
2. Open Tab 2: Navigate to http://localhost:5173/admin/dashboard
3. Login in Tab 1 as regular user
4. Go to Tab 2 → should redirect to /my-files automatically
5. Verify role-based routing works across tabs
```

### Test 8: Deep Links After Login
```
1. Clear localStorage
2. Open http://localhost:5173/admin/dashboard directly in new tab
3. Should redirect to /login
4. Login as admin
5. After login, should redirect to /admin/dashboard
6. Now you can access /admin/dashboard directly
```

### Browser Console Logs to Verify

When logging in, check browser console (F12 → Console) for:
```
[API] Network error... (if backend is down)
[AuthContext] Network error on login... (if network fails)
```

After successful login:
```
No errors should appear
Navigation should be immediate
```

### Expected Behavior Summary

| Scenario | Expected Result |
|----------|-----------------|
| Regular user login | → `/my-files` |
| Admin user login | → `/admin/dashboard` |
| Regular user accesses `/admin/dashboard` | → `/my-files` |
| Regular user accesses `/login` when logged in | → `/my-files` |
| Admin user accesses `/login` when logged in | → `/admin/dashboard` |
| Unauthenticated access to `/my-files` | → `/login` |
| Unauthenticated access to `/admin/dashboard` | → `/login` |
| Network error during login | Shows error message with server URL |

## Troubleshooting

### Issue: Redirects to login after successful login
**Solution:**
- Check backend is running on port 5000
- Verify database is connected
- Check user data has `role` and `email` fields
- Check localStorage has token saved

### Issue: Admin user doesn't see admin dashboard
**Solution:**
- Verify admin email is exactly `admin@gmail.com`
- Verify admin role is `admin`
- Check browser console for errors
- Clear localStorage and login again

### Issue: Can't access any page after login
**Solution:**
- Clear localStorage: `localStorage.clear()`
- Refresh page
- Check browser console for errors
- Verify backend API is responding

### Issue: Network error message even though backend is running
**Solution:**
- Check backend is on `http://localhost:5000`
- Check CORS is configured correctly
- Verify frontend API URL in `frontend/src/services/api.js` is `http://127.0.0.1:5000/api`
- Check no firewall is blocking connection

## Performance Notes
- First login should redirect within 500-700ms
- Navigation should be instant after initial load
- No loading screen should appear between login and dashboard

## Security Notes
- Password must be min 6 characters for non-admin, 8 chars with uppercase/lowercase/number/special for regular users
- Tokens expire after 24 hours
- Session stored in MongoDB with TTL
- Refresh tokens manage token renewal automatically
