# Dashboard Issue - Diagnostic Steps

## Problem Description
"User dashboard is not displaying - admin dashboard is only visible"

## What This Could Mean
1. **Admin dashboard content showing at `/my-files`** - Wrong component rendered
2. **User redirected to `/admin/dashboard`** - Wrong route navigation
3. **Sidebar showing admin-only options** - Role incorrectly set as admin
4. **Default load shows admin page** - Route defaults to admin

## Diagnostic Steps (Follow in Order)

### Step 1: Clear All Local Storage & Cache
```javascript
// Open browser DevTools (F12) → Console tab, paste this:
localStorage.clear();
sessionStorage.clear();
location.reload();
```
**Result:** Page should redirect to /login with blank login form

### Step 2: Register a New Regular User
1. Click "Don't have an account? Register"
2. Fill in:
   - Name: `Test User`
   - Email: `testuser@example.com`
   - Password: `TestPass123!`
3. Complete registration
4. **Check:** Should be redirected to `/my-files` with user dashboard visible
5. Check browser console for errors

### Step 3: Check User Data in Console
```javascript
// In browser DevTools Console:
console.log('User Info:', JSON.parse(localStorage.getItem('userInfo')));
console.log('Token exists:', !!localStorage.getItem('token'));
```
**Expected Output:**
```
User Info: {
  _id: "...",
  name: "Test User",
  email: "testuser@example.com",
  role: "user",    // <-- MUST be "user", not "admin"
  ...
}
Token exists: true
```

### Step 4: Logout and Login Again
1. Click logout button
2. Login with `testuser@example.com` and password `TestPass123!`
3. **Check:** Should redirect to `/my-files`
4. Verify sidebar shows only user nav items (My Files, History, Favorites, etc.)
5. **NOT** showing "Admin Dashboard"

### Step 5: Admin Login for Comparison
1. Logout
2. Login with:
   - Email: `admin@gmail.com`
   - Password: `789654`
3. **Check:** Should redirect to `/admin/dashboard`
4. Verify sidebar shows only "Admin Dashboard" option
5. Check console:
```javascript
console.log('Admin User:', JSON.parse(localStorage.getItem('userInfo')));
// Should show role: "admin" and email: "admin@gmail.com"
```

### Step 6: Check Network Requests
1. Open DevTools → Network tab
2. Clear network log
3. Go to `/login`
4. Login with regular user
5. Check the login API response:
   - Look for `POST /api/auth/login` request
   - Click on it → Response tab
   - **Check:** Should show `"role": "user"`

### Step 7: Check Routing Logic
```javascript
// In DevTools Console during user dashboard:
const user = JSON.parse(localStorage.getItem('userInfo'));
console.log('Is Admin?', user?.role === 'admin' && user?.email === 'admin@gmail.com');
console.log('Current Path:', window.location.pathname);
console.log('Should be at: /my-files');
```

## What to Report Back

Please run through the steps above and tell me:

1. **At what step does it fail?**
   - Step 1: Can't clear localStorage?
   - Step 2: Register fails or redirects wrong?
   - Step 3: User role shows as "admin" or "user"?
   - Step 4: Sidebar shows wrong nav items?
   - Step 5: Admin login works correctly?
   - Step 6: API response shows correct role?

2. **What does the user role show in localStorage?**
   ```
   For regular user: role should be "user"
   For admin: role should be "admin"
   ```

3. **What page are you currently seeing?**
   - Are you at `/my-files` but seeing admin content?
   - Or are you being redirected to `/admin/dashboard`?
   - Or is the sidebar showing admin-only options?

4. **Any console errors?**
   - Press F12
   - Go to Console tab
   - Screenshot/copy any red error messages

## Quick Fixes to Try

### Fix A: Clear localStorage and restart
```bash
# In browser console:
localStorage.clear();
location.reload();
```

### Fix B: Check backend is running
```bash
# In terminal:
curl http://localhost:5000/api/auth/status
# Should return: { status: 'ok' }
```

### Fix C: Restart both frontend and backend
```bash
# Terminal 1:
cd backend && npm start

# Terminal 2 (new):
cd frontend && npm run dev
```

## Expected Behavior Summary

| User Type | Login Path | Sees Dashboard | Sidebar Shows |
|-----------|-----------|----------------|---------------|
| Regular User | /login → testuser@example.com | /my-files | My Files, History, Favorites, Trash, Settings |
| Admin | /login → admin@gmail.com | /admin/dashboard | Admin Dashboard |
| Not Logged In | Any path | Redirects to /login | N/A |

## If Issue Persists

Please provide:
1. Console logs from Step 6 (user role value)
2. Screenshot of what you're seeing
3. Which step in the diagnostic fails
4. Backend console logs if any errors

This will help identify if the issue is:
- **Backend:** Role not being set correctly
- **Frontend:** Role not being stored/read correctly
- **Routing:** Wrong component being rendered
- **Cache:** Stale data in localStorage
