import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Mail, Lock, ArrowRight, ShieldCheck, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import vibnaLogo from '../components/Vibna.png';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider, firebaseConfigured } from '../firebase';

import GoogleAccountSignInModal from '../components/GoogleAccountSignInModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const GOOGLE_INTENT_KEY = 'vibna_google_intent'; // sessionStorage key to persist login vs sign-up across redirect

const getFirebaseUnauthorizedHint = (err) => {
  const code = err?.code || '';
  if (code.includes('unauthorized-domain')) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'your app domain';
    return `Firebase: The domain running this app (${origin}) is not authorized in the Firebase console. Add ${origin} to Authorized domains under Authentication settings.`;
  }
  return null;
};

// Call VIBNA backend with the Firebase ID token.
// isSignUp=false  → LOGIN mode  → 404 if no account exists
// isSignUp=true   → REGISTER mode → auto-creates account if none exists
const callVibnaGoogleAuth = async (loginWithGoogle, idToken, isSignUp) => {
  return await loginWithGoogle(idToken, isSignUp);
};

// ─── Component ────────────────────────────────────────────────────────────────
const Login = ({ mode }) => {
  const { login, loginWithGoogle } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const isUrlAdmin = mode === 'admin' || location.pathname.startsWith('/admin') || location.search.includes('role=admin');

  // Read the ?redirect= query parameter so we can return the user to the
  // document (or page) they originally tried to access before being sent here.
  // Sanitise: only allow relative paths (starting with /) to prevent open-redirect attacks.
  const getRedirectPath = (userData) => {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      return redirect;
    }
    // Fallback: role-based default
    if (userData?.role === 'admin') return '/admin/dashboard';
    return '/dashboard';
  };

  const redirectByRole = (userData) => {
    if (!userData) return;
    navigate(getRedirectPath(userData), { replace: true });
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);

  // ── Handle Google redirect result (fires after signInWithRedirect completes) ──
  useEffect(() => {
    if (!auth) return; // Firebase not configured

    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!result?.user) return; // No redirect result pending — nothing to do

        // Read the intent we stored before the redirect
        const storedIntent = sessionStorage.getItem(GOOGLE_INTENT_KEY);
        sessionStorage.removeItem(GOOGLE_INTENT_KEY); // clean up immediately

        // This is the Login page, so intent must be 'login' (isSignUp = false).
        // If intent was 'register', let the Register page handle it — we should not process it here.
        if (storedIntent === 'register') {
          // The redirect came from the Register page. Navigate there so it can handle getRedirectResult.
          navigate('/register', { replace: true });
          return;
        }

        setGoogleLoading(true);
        const idToken = await result.user.getIdToken(true);

        try {
          // LOGIN mode: verify account exists, DO NOT create a new one
          const userData = await callVibnaGoogleAuth(loginWithGoogle, idToken, false);
          setSuccess(true);
          redirectByRole(userData);
        } catch (backendErr) {
          // Sign out of Firebase so the stale Google session doesn't persist
          try { await firebaseSignOut(auth); } catch (_) {}
          const status = backendErr?.response?.status;
          let msg;
          if (status === 404) {
            msg = 'No VIBNA Storage account found for this Google account. Please create an account first.';
          } else {
            msg = backendErr?.response?.data?.message || backendErr?.message || 'Google sign-in failed. Please try again.';
          }
          setError(msg);
          setGoogleLoading(false);
        }
      } catch (err) {
        if (err.code === 'auth/no-auth-event' || err.code === 'auth/popup-closed-by-user') {
          return; // User cancelled — silent
        }
        console.error('[Google Redirect] error:', err);
        try { if (auth) await firebaseSignOut(auth); } catch (_) {}
        const hint = getFirebaseUnauthorizedHint(err);
        setError(hint || err?.response?.data?.message || err?.message || 'Google sign-in failed.');
        setGoogleLoading(false);
      } finally {
        // Only clear loading if we didn't navigate away
        setGoogleLoading(false);
      }
    };

    handleRedirectResult();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle Google popup click ──────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);

    let firebaseResult;
    try {
      firebaseResult = await signInWithPopup(auth, googleProvider);
    } catch (firebaseErr) {
      if (
        firebaseErr.code === 'auth/popup-blocked' ||
        firebaseErr.code === 'auth/cancelled-popup-request' ||
        firebaseErr.code === 'auth/internal-error'
      ) {
        // Popup was blocked — fall back to redirect.
        // Store intent so the redirect result handler knows this was a LOGIN attempt.
        sessionStorage.setItem(GOOGLE_INTENT_KEY, 'login');
        console.warn(`[Google Sign-In] ${firebaseErr.code} — falling back to redirect.`);
        await signInWithRedirect(auth, googleProvider);
        return; // Page will redirect away
      }
      if (firebaseErr.code === 'auth/popup-closed-by-user') {
        setGoogleLoading(false);
        return; // User cancelled — silent
      }
      console.error('[Google Sign-In] Firebase error:', firebaseErr);
      const hint = getFirebaseUnauthorizedHint(firebaseErr);
      setError(hint || firebaseErr.message || 'Google sign-in failed. Please try again.');
      setGoogleLoading(false);
      return;
    }

    // Firebase authenticated successfully — now verify with VIBNA backend
    try {
      const idToken = await firebaseResult.user.getIdToken(true);
      // LOGIN mode: isSignUp = false → backend returns 404 if no VIBNA account exists
      const userData = await callVibnaGoogleAuth(loginWithGoogle, idToken, false);
      setSuccess(true);
      setGoogleLoading(false);
      redirectByRole(userData);
    } catch (backendErr) {
      // Sign out of Firebase so the Google session doesn't linger
      try { await firebaseSignOut(auth); } catch (_) {}
      console.error('[Google Sign-In] Backend error:', backendErr);
      const status = backendErr?.response?.status;
      let msg;
      if (status === 404) {
        msg = 'No VIBNA Storage account found for this Google account. Please create an account first.';
      } else {
        msg = backendErr?.response?.data?.message || backendErr?.message || 'Google sign-in failed. Please try again.';
      }
      setError(msg);
      setGoogleLoading(false);
    }
  };

  // ── Email/password login ───────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const normalizedIdentifier = email.trim();
    if (!normalizedIdentifier) {
      setError('Please enter your email or username');
      return;
    }

    setLoading(true);
    try {
      const userData = await login(normalizedIdentifier.toLowerCase(), password);
      // Save login info locally for fast future sign-in
      try {
        const raw = localStorage.getItem('vibna_saved_accounts');
        const list = raw ? JSON.parse(raw) : [];
        const updated = list.filter(acc => acc.email.toLowerCase() !== email.trim().toLowerCase());
        updated.unshift({
          name: userData.name || email.trim().split('@')[0],
          email: email.trim().toLowerCase(),
          password,
          lastUsed: new Date().toISOString()
        });
        localStorage.setItem('vibna_saved_accounts', JSON.stringify(updated.slice(0, 5)));
      } catch (e) {}

      setSuccess(true);
      setTimeout(() => redirectByRole(userData), 1000);
    } catch (err) {
      let errorMessage = 'Failed to login';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        if (err.message.includes('Failed to fetch') || err.message.includes('ERR_')) {
          errorMessage = 'Network error: Unable to connect to server. Please check if the backend is running on http://localhost:5000';
        } else if (err.code === 'ERR_NETWORK') {
          errorMessage = 'Network error: Cannot reach the server';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
      setLoading(false);
      setSuccess(false);
    }
  };

  // Pre-fill saved credentials on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vibna_saved_accounts');
      if (raw) {
        const accounts = JSON.parse(raw);
        if (accounts.length > 0 && accounts[0].email) {
          setEmail(accounts[0].email);
          if (accounts[0].password) {
            setPassword(accounts[0].password);
          }
        }
      }
    } catch (e) {}
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-black text-[#F5F5F5] overflow-hidden relative">
      <style>{`
        @keyframes streakMove1 {
          0% { transform: translate(-30%, -20%) rotate(-35deg); opacity: 0.03; }
          50% { transform: translate(-10%, 10%) rotate(-35deg); opacity: 0.12; }
          100% { transform: translate(-30%, -20%) rotate(-35deg); opacity: 0.03; }
        }
        @keyframes streakMove2 {
          0% { transform: translate(20%, 30%) rotate(-35deg); opacity: 0.02; }
          50% { transform: translate(0%, 0%) rotate(-35deg); opacity: 0.08; }
          100% { transform: translate(20%, 30%) rotate(-35deg); opacity: 0.02; }
        }
        @keyframes cardGlow {
          0%, 100% { box-shadow: 0 0 40px rgba(212, 164, 55, 0.04); }
          50% { box-shadow: 0 0 60px rgba(212, 164, 55, 0.10); }
        }
        @keyframes shineEffect {
          0% { transform: translateX(-200%) skewX(-30deg); }
          100% { transform: translateX(200%) skewX(-30deg); }
        }
      `}</style>

      {/* LEFT SIDE - Brand & Visuals */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 bg-[#080808] border-r border-[#d4af37]/10 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* Streak 1 */}
          <div
            className="absolute top-0 left-0 w-[500px] h-[700px] bg-gradient-to-b from-transparent via-[#d4af37]/10 to-transparent blur-[120px] pointer-events-none"
            style={{ animation: 'streakMove1 22s infinite ease-in-out' }}
          />
          {/* Streak 2 */}
          <div
            className="absolute bottom-0 right-0 w-[400px] h-[600px] bg-gradient-to-b from-transparent via-[#b8860b]/5 to-transparent blur-[100px] pointer-events-none"
            style={{ animation: 'streakMove2 28s infinite ease-in-out' }}
          />
          {/* Soft moving background gradients */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.06, 0.12, 0.06] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-[#B8860B] blur-[150px] mix-blend-screen"
          />
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.04, 0.09, 0.04] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-[#D4A437] blur-[130px] mix-blend-screen"
          />
        </div>

        {/* Content Centered */}
        <div className="relative z-10 flex flex-col items-center text-center w-full max-w-lg">
          {/* Logo with sweep animation */}
          <div className="relative overflow-hidden flex items-center justify-center p-2 mb-8 w-52 h-52">
            <motion.img
              initial={{ opacity: 0, scale: 0.75, filter: 'drop-shadow(0 0 0px rgba(212,164,55,0))' }}
              animate={{
                opacity: 1,
                scale: 1,
                filter: [
                  'drop-shadow(0 0 8px rgba(212,164,55,0.15))',
                  'drop-shadow(0 0 25px rgba(212,164,55,0.45))',
                  'drop-shadow(0 0 15px rgba(212,164,55,0.25))',
                ],
              }}
              transition={{ duration: 1.8, ease: 'easeOut', filter: { times: [0, 0.6, 1], duration: 1.8 } }}
              src={vibnaLogo}
              alt="Vibna logo"
              className="w-full h-full object-contain"
            />
            {/* Diagonal light sweep */}
            <motion.div
              initial={{ left: '-150%', skewX: -30 }}
              animate={{ left: '150%' }}
              transition={{ delay: 0.8, duration: 1.4, ease: 'easeInOut' }}
              className="absolute top-0 h-full w-[60px] bg-gradient-to-r from-transparent via-[#d4af37]/30 to-transparent pointer-events-none"
              style={{ mixBlendMode: 'screen' }}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
          >
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-6 text-white tracking-tight">
              Secure{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#B8860B] to-[#D4A437] drop-shadow-[0_2px_10px_rgba(212,164,55,0.15)]">
                AI-Powered
              </span>
              <br /> Cloud Storage
            </h1>
            <p className="text-base lg:text-lg text-slate-400 max-w-md mx-auto font-light leading-relaxed">
              Experience the next generation of file management. Fast, secure, and beautiful.
            </p>

            <div className="flex items-center justify-center gap-4 mt-12 bg-black/40 p-4 rounded-2xl backdrop-blur-md border border-[#d4af37]/10 shadow-[0_0_20px_rgba(212,164,55,0.03)] max-w-sm mx-auto">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/20 shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#d4af37]" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-[#d4af37]">Military-grade Security</p>
                <p className="text-xs text-slate-400">Your files are encrypted at rest</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* RIGHT SIDE - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-black">
        {/* Soft background light */}
        <div className="absolute top-10 right-10 w-[300px] h-[300px] rounded-full bg-[#D4A437]/5 blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md z-10"
        >
          {/* Header */}
          <div className="mb-6 text-center lg:text-left">
            <div className="mb-4 flex items-center justify-center lg:justify-start gap-4">
              <div className="relative overflow-hidden w-14 h-14 shrink-0">
                <motion.img
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8 }}
                  src={vibnaLogo}
                  alt="Vibna logo"
                  className="w-full h-full object-contain mix-blend-screen drop-shadow-[0_0_12px_rgba(212,164,55,0.3)]"
                />
                <motion.div
                  initial={{ left: '-150%', skewX: -30 }}
                  animate={{ left: '150%' }}
                  transition={{ delay: 0.4, duration: 1.2, ease: 'easeInOut' }}
                  className="absolute top-0 h-full w-[25px] bg-gradient-to-r from-transparent via-[#d4af37]/20 to-transparent pointer-events-none"
                />
              </div>
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-white">
                  {isUrlAdmin ? 'Admin Portal' : 'Welcome Back'}
                </h2>
                <p className="text-slate-400 mt-1 font-light text-sm">
                  {isUrlAdmin ? 'Sign in with administrator credentials' : 'Sign in to your VIBNA account'}
                </p>
              </div>
            </div>
          </div>

          {/* Card with shining border */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl p-[1px] bg-gradient-to-b from-[#d4af37]/25 via-[#d4af37]/5 to-transparent relative overflow-hidden"
            style={{ animation: 'cardGlow 8s infinite ease-in-out' }}
          >
            {/* Shining sweep overlay */}
            <div className="bg-[#050505] rounded-[23px] overflow-hidden">
              <Card className="p-8 backdrop-blur-2xl bg-[#111111]/90 border-transparent shadow-none hover:shadow-none transition-none">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Admin Demo Shortcut Pill */}
                  {isUrlAdmin && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-xl flex items-center justify-between text-xs text-[#d4af37]"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span><strong>Admin Demo:</strong> admin@gmail.com</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('admin@gmail.com');
                          setPassword('789654');
                          setError('');
                        }}
                        className="px-2.5 py-1 bg-[#d4af37] text-black font-semibold rounded-lg text-[11px] hover:bg-[#b8860b] transition-colors"
                      >
                        Auto-Fill
                      </button>
                    </motion.div>
                  )}

                  {/* Error Banner */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm"
                    >
                      <ShieldCheck className="w-5 h-5 shrink-0" />
                      <p>{error}</p>
                    </motion.div>
                  )}

                  {/* Email / Username */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300 ml-1">Email or Username</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-slate-500" />
                      </div>
                      <Input
                        type="text"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        className="pl-11 border-white/5 bg-[#1A1A1A]/40 focus:border-[#D4A437] focus:ring-1 focus:ring-[#D4A437]/40 focus:shadow-[0_0_15px_rgba(212,164,55,0.15)] transition-all duration-300"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-sm font-semibold text-slate-300">Password</label>
                      <a href="#" className="text-xs text-[#d4af37] hover:text-[#B8860B] transition-colors font-medium">
                        Forgot password?
                      </a>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-500" />
                      </div>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        className="pl-11 pr-11 border-white/5 bg-[#1A1A1A]/40 focus:border-[#D4A437] focus:ring-1 focus:ring-[#D4A437]/40 focus:shadow-[0_0_15px_rgba(212,164,55,0.15)] transition-all duration-300"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember me */}
                  <div className="flex items-center gap-2.5 mt-2">
                    <input
                      type="checkbox"
                      id="remember"
                      className="rounded border-white/10 bg-slate-900 text-[#D4A437] focus:ring-[#D4A437]/50 focus:ring-offset-black"
                    />
                    <label htmlFor="remember" className="text-sm text-slate-400 font-light select-none">
                      Remember me for 30 days
                    </label>
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="w-full h-12 text-base mt-2 gap-2 bg-gradient-to-r from-[#B8860B] to-[#D4A437] text-black font-semibold shadow-[0_0_20px_rgba(212,164,55,0.25)] hover:shadow-[0_0_30px_rgba(212,164,55,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] border-none"
                    disabled={loading || success}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Signing you in...</span>
                      </>
                    ) : success ? (
                      <>
                        <ShieldCheck className="w-5 h-5 animate-pulse" />
                        <span>Success! Accessing Storage...</span>
                      </>
                    ) : (
                      <>
                        <span>{isUrlAdmin ? 'Sign In as Admin' : 'Sign In'}</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </Button>

                  {/* ─── Divider ─────────────────────────────────────── */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-xs text-slate-500 font-light">or</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  {/* ─── Continue with Google ────────────────────────── */}
                  <button
                    id="google-signin-btn"
                    type="button"
                    onClick={() => setIsGoogleModalOpen(true)}
                    style={{
                      width: '100%',
                      height: '48px',
                      marginTop: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      background: '#111111',
                      border: '1px solid rgba(212,175,55,0.35)',
                      borderRadius: '12px',
                      color: '#e5e5e5',
                      fontSize: '15px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      boxShadow: '0 0 0 0 rgba(212,175,55,0)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#1a1a1a';
                      e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)';
                      e.currentTarget.style.boxShadow = '0 0 18px rgba(212,175,55,0.12)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#111111';
                      e.currentTarget.style.borderColor = 'rgba(212,175,55,0.35)';
                      e.currentTarget.style.boxShadow = '0 0 0 0 rgba(212,175,55,0)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    aria-label="Sign in with Google Account"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" style={{ width: 20, height: 20, flexShrink: 0, filter: 'saturate(0.7) brightness(1.1)' }}>
                      <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.5-36.2-4.3-53.4H272v101h147.1c-6.3 34.2-25.6 63.2-54.6 82.6v68h88.2c51.6-47.5 81.8-117.6 81.8-198.2z"/>
                      <path fill="#34A853" d="M272 544.3c73.5 0 135.2-24.4 180.3-66.3l-88.2-68c-24.5 16.5-55.8 26.3-92.1 26.3-70.8 0-130.8-47.7-152.2-111.6h-90.5v69.9C82.8 485.4 167.9 544.3 272 544.3z"/>
                      <path fill="#FBBC05" d="M119.8 325.9c-10.6-31.5-10.6-65.6 0-97.1v-69.9h-90.5c-39.6 78.1-39.6 170.1 0 248.2l90.5-69.9z"/>
                      <path fill="#EA4335" d="M272 107.1c39.9 0 75.9 13.7 104.2 40.7l78.2-78.2C407.2 24.8 345.5 0 272 0 167.9 0 82.8 58.9 29.3 147.6l90.5 69.9C141.2 154.8 201.2 107.1 272 107.1z"/>
                    </svg>
                    <span>Sign in with Google</span>
                  </button>
                </form>

                {/* Register link */}
                <div className="mt-8 text-center text-sm text-slate-400 font-light">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-[#d4af37] hover:text-[#B8860B] font-medium transition-colors">
                    Create account
                  </Link>
                </div>
              </Card>
            </div>
          </motion.div>
        </motion.div>

        {/* Google Account Sign-In Modal */}
        <GoogleAccountSignInModal
          isOpen={isGoogleModalOpen}
          onClose={() => setIsGoogleModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default Login;
