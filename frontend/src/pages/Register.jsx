import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Mail, Lock, User, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import vibnaLogo from '../components/vibna.png';
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider, firebaseConfigured } from '../firebase';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const GOOGLE_INTENT_KEY = 'vibna_google_intent'; // shared with Login.jsx

// ─── Component ────────────────────────────────────────────────────────────────
const Register = () => {
  const { register, loginWithGoogle } = useContext(AuthContext);
  const navigate = useNavigate();

  const redirectByRole = (userData) => {
    if (!userData) return;
    if (userData.role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  const [name, setName] = useState('');
  const [emailHandle, setEmailHandle] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [createdAccount, setCreatedAccount] = useState(null);

  const validatePassword = (pass) => {
    const minLen = pass.length >= 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNum = /[0-9]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    return { minLen, hasUpper, hasLower, hasNum, hasSpecial, isValid: minLen && hasUpper && hasLower && hasNum && hasSpecial };
  };

  const passValidation = validatePassword(password);

  // ── Handle Google redirect result (fires after signInWithRedirect completes) ──
  useEffect(() => {
    if (!auth) return; // Firebase not configured

    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!result?.user) return; // No redirect result — nothing to do

        const storedIntent = sessionStorage.getItem(GOOGLE_INTENT_KEY);
        sessionStorage.removeItem(GOOGLE_INTENT_KEY);

        if (storedIntent === 'login') {
          navigate('/login', { replace: true });
          return;
        }

        setGoogleLoading(true);
        const idToken = await result.user.getIdToken(true);

        try {
          const userData = await loginWithGoogle(idToken, true);
          setGoogleLoading(false);
          setCreatedAccount(userData);
          setTimeout(() => redirectByRole(userData), 1800);
        } catch (backendErr) {
          try { await firebaseSignOut(auth); } catch (_) {}
          const msg = backendErr?.response?.data?.message || backendErr?.message || 'Google account creation failed.';
          setError(msg);
          setGoogleLoading(false);
        }
      } catch (err) {
        if (err.code === 'auth/no-auth-event' || err.code === 'auth/popup-closed-by-user') {
          return;
        }
        console.error('[Google Redirect Register] error:', err);
        try { if (auth) await firebaseSignOut(auth); } catch (_) {}
        const code = err?.code || '';
        let msg = err?.response?.data?.message || err?.message || 'Google account creation failed.';
        if (code.includes('unauthorized-domain')) {
          const origin = typeof window !== 'undefined' ? window.location.origin : 'app domain';
          msg = `Firebase error: Domain ${origin} is not authorized in Firebase Console. Add ${origin} under Authentication > Settings > Authorized domains.`;
        }
        setError(msg);
        setGoogleLoading(false);
      } finally {
        setGoogleLoading(false);
      }
    };

    handleRedirectResult();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle Google popup for registration ────────────────────────────────────
  const handleGoogleSignUp = async () => {
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
        sessionStorage.setItem(GOOGLE_INTENT_KEY, 'register');
        console.warn(`[Google Sign-Up] ${firebaseErr.code} — falling back to redirect.`);
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      if (firebaseErr.code === 'auth/popup-closed-by-user') {
        setGoogleLoading(false);
        return;
      }
      console.error('[Google Sign-Up] Firebase error:', firebaseErr);
      const code = firebaseErr?.code || '';
      let msg = firebaseErr.message || 'Google account creation failed. Please try again.';
      if (code.includes('unauthorized-domain')) {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'app domain';
        msg = `Firebase error: Domain ${origin} is not authorized in Firebase Console. Add ${origin} under Authentication > Settings > Authorized domains.`;
      }
      setError(msg);
      setGoogleLoading(false);
      return;
    }

    try {
      const idToken = await firebaseResult.user.getIdToken(true);
      const userData = await loginWithGoogle(idToken, true);
      setGoogleLoading(false);
      setCreatedAccount(userData);
      setTimeout(() => redirectByRole(userData), 1800);
    } catch (backendErr) {
      try { await firebaseSignOut(auth); } catch (_) {}
      console.error('[Google Sign-Up] Backend error:', backendErr);
      let errorMessage = 'Google account creation failed. Please try again.';
      if (backendErr?.response?.data?.message) {
        errorMessage = backendErr.response.data.message;
      } else if (backendErr?.message) {
        if (backendErr.message.includes('Failed to fetch') || backendErr.message.includes('ERR_')) {
          errorMessage = 'Network error: Unable to connect to server';
        } else {
          errorMessage = backendErr.message;
        }
      }
      setError(errorMessage);
      setGoogleLoading(false);
    }
  };

  // ── Manual registration form submit ─────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const handle = emailHandle.toLowerCase().trim();
    if (!handle) {
      setError('Email handle is required');
      return;
    }
    if (handle.length < 3) {
      setError('Email handle must be at least 3 characters');
      return;
    }
    if (!/^[a-z0-9._]+$/.test(handle)) {
      setError('Email handle can only contain lowercase letters, numbers, dots and underscores');
      return;
    }

    const fullEmail = `${handle}@vibna.storage`;

    const trimmedMobile = mobile.trim();
    if (trimmedMobile) {
      if (!/^[0-9]{10}$/.test(trimmedMobile)) {
        setError('Please enter a valid 10-digit mobile number');
        return;
      }
    }

    if (!passValidation.isValid) {
      setError('Please ensure your password meets all requirements');
      return;
    }

    setLoading(true);
    try {
      const userData = await register(name, fullEmail, trimmedMobile || null, password);
      setLoading(false);
      redirectByRole(userData);
    } catch (err) {
      let errorMessage = 'Failed to register';
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
    }
    setLoading(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-black text-[#F5F5F5] overflow-hidden">
      {/* LEFT SIDE - Brand & Visuals */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 bg-[#111111]/80 overflow-hidden border-r border-[#d4af37]/10">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-[#B8860B]/20 blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[60%] rounded-full bg-[#D4A437]/20 blur-[100px] mix-blend-screen" />
        </div>

        <motion.div
          animate={{ y: [0, -20, 0], rotate: [0, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/4 w-32 h-32 rounded-3xl border border-white/10 bg-gradient-to-tr from-secondary/10 to-transparent backdrop-blur-md z-0"
        />
        <motion.div
          animate={{ y: [0, 30, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 right-1/4 w-24 h-24 rounded-full border border-white/10 bg-gradient-to-bl from-primary/10 to-transparent backdrop-blur-md z-0"
        />

        <div className="relative z-10 flex flex-col items-center justify-center text-center mt-auto mb-auto">
          <img src={vibnaLogo} alt="Vibna logo" className="w-32 h-32 object-contain mix-blend-screen mb-6 drop-shadow-[0_0_20px_rgba(212,164,55,0.4)]" />
          <h1 className="text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#d4af37] mb-4 text-center">
            VIBNA
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-5xl font-bold leading-tight mb-6">
              Join the <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#B8860B] to-[#D4A437]">Future</span><br/> of Storage
            </h1>
            <p className="text-lg text-slate-400 max-w-md mx-auto">
              Create your account to start securely storing and sharing your files in the cloud.
            </p>

            <div className="flex flex-col items-center gap-4 mt-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black border border-[#d4af37]/20 shadow-inner">
                <ShieldCheck className="w-6 h-6 text-[#d4af37]" />
              </div>
              <div>
                <p className="font-medium text-white">Military-grade Security</p>
                <p className="text-sm text-slate-500">Your files are encrypted at rest</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* RIGHT SIDE - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto max-h-screen">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md my-auto pb-10 pt-10 lg:pt-0"
        >
          <div className="mb-8 lg:hidden flex justify-center">
             <img src={vibnaLogo} alt="Vibna logo" className="w-16 h-16 object-contain mix-blend-screen drop-shadow-[0_0_15px_rgba(212,164,55,0.4)]" />
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold mb-2">
              {createdAccount ? 'Account Created' : 'Create Account'}
            </h2>
            <p className="text-slate-400">
              {createdAccount ? 'Your Google account has been verified' : 'Sign up to get started'}
            </p>
          </div>

          {createdAccount ? (
            <Card className="p-8 backdrop-blur-2xl bg-[#111111]/90 border-[#d4af37]/30 text-center space-y-5 shadow-[0_0_40px_rgba(212,164,55,0.15)]">
              <div className="w-16 h-16 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/40 flex items-center justify-center mx-auto text-[#d4af37]">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-white">Google Account Created & Verified!</h3>
                <p className="text-sm text-slate-400">Your VIBNA Storage access account is active</p>
              </div>

              <div className="bg-black/60 rounded-2xl p-4 border border-[#d4af37]/15 space-y-3 text-left text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Full Name</span>
                  <span className="font-semibold text-white">{createdAccount.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">VIBNA Storage Email</span>
                  <span className="font-mono text-[#d4af37] text-xs font-semibold">{createdAccount.vibnaEmail || `${createdAccount.email.split('@')[0]}@vibna.storage`}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Google OAuth Email</span>
                  <span className="font-mono text-slate-300 text-xs">{createdAccount.googleEmail || createdAccount.email}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                  <span className="text-slate-400 text-xs">Authentication Status</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                    <ShieldCheck className="w-4 h-4" /> Verified by Google OAuth
                  </span>
                </div>
              </div>

              <Button
                onClick={() => redirectByRole(createdAccount)}
                className="w-full h-12 bg-gradient-to-r from-[#B8860B] to-[#D4A437] text-black font-semibold text-base gap-2 shadow-[0_0_20px_rgba(212,164,55,0.3)] hover:scale-[1.02] border-none"
              >
                <span>Entering Dashboard...</span>
                <Loader2 className="w-5 h-5 animate-spin" />
              </Button>
            </Card>
          ) : (
            <Card className="p-8 backdrop-blur-2xl bg-[#111111]/80 border-[#d4af37]/20 shadow-[0_0_30px_rgba(212,164,55,0.05)]">
              <form onSubmit={handleSubmit} className="space-y-5">
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

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-500" />
                    </div>
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setError(''); }}
                      className="pl-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
                  <div className="flex items-center">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-slate-500" />
                      </div>
                      <Input
                        type="text"
                        placeholder="your.name"
                        value={emailHandle}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '');
                          setEmailHandle(val);
                          setError('');
                        }}
                        className="pl-11 rounded-r-none border-r-0 focus:border-[#D4A437]"
                        required
                      />
                    </div>
                    <span className="flex h-12 items-center justify-center bg-[#1A1A1A]/70 border border-white/10 border-l-0 rounded-r-xl px-4 text-sm font-mono text-[#d4af37] select-none">
                      @vibna.storage
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 ml-1">Unique for this VIBNA application</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Mobile Number (Optional)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="h-5 w-5 text-slate-500 text-base select-none">📱</span>
                    </div>
                    <Input
                      type="tel"
                      placeholder="10-digit number (optional)"
                      value={mobile}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 10) {
                          setMobile(val);
                          setError('');
                        }
                      }}
                      className="pl-11"
                    />
                  </div>
                  <p className="text-xs text-slate-500 ml-1">Optional 10-digit number</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-500" />
                      </div>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        className={`pl-11 pr-11 ${password && !passValidation.isValid ? 'border-rose-500/50 focus-visible:ring-rose-500 focus-visible:border-rose-500' : ''}`}
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
                  {/* Password Strength Validation */}
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1 bg-slate-950/50 p-3 rounded-lg border border-white/5 text-xs text-slate-400">
                      <p className={`flex items-center gap-1 ${passValidation.minLen ? 'text-emerald-400' : ''}`}>
                        <CheckCircle2 className="w-3 h-3" /> Minimum 8 characters
                      </p>
                      <p className={`flex items-center gap-1 ${passValidation.hasUpper ? 'text-emerald-400' : ''}`}>
                        <CheckCircle2 className="w-3 h-3" /> At least one uppercase letter
                      </p>
                      <p className={`flex items-center gap-1 ${passValidation.hasLower ? 'text-emerald-400' : ''}`}>
                        <CheckCircle2 className="w-3 h-3" /> At least one lowercase letter
                      </p>
                      <p className={`flex items-center gap-1 ${passValidation.hasNum ? 'text-emerald-400' : ''}`}>
                        <CheckCircle2 className="w-3 h-3" /> At least one number
                      </p>
                      <p className={`flex items-center gap-1 ${passValidation.hasSpecial ? 'text-emerald-400' : ''}`}>
                        <CheckCircle2 className="w-3 h-3" /> At least one special character
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base mt-2 gap-2 bg-gradient-to-r from-[#B8860B] to-[#D4A437] text-black font-semibold shadow-[0_0_20px_rgba(212,164,55,0.25)] hover:shadow-[0_0_30px_rgba(212,164,55,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] border-none"
                  disabled={loading || googleLoading || (password.length > 0 && !passValidation.isValid)}
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /><span>Creating account...</span></>
                  ) : (
                    <><span>Create Account</span><ArrowRight className="w-5 h-5" /></>
                  )}
                </Button>
              </form>

              {/* ─── Divider ────────────────────────────────────────── */}
              <div className="flex items-center gap-3 mt-5">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-xs text-slate-500 font-light">or</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {/* ─── Continue with Google ────────────────────────────── */}
              <button
                id="google-signup-btn"
                type="button"
                onClick={() => navigate('/create-google-account')}
                style={{
                  width: '100%',
                  height: '48px',
                  marginTop: '16px',
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
                aria-label="Create account with Google"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" style={{ width: 20, height: 20, flexShrink: 0, filter: 'saturate(0.7) brightness(1.1)' }}>
                  <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.5-36.2-4.3-53.4H272v101h147.1c-6.3 34.2-25.6 63.2-54.6 82.6v68h88.2c51.6-47.5 81.8-117.6 81.8-198.2z"/>
                  <path fill="#34A853" d="M272 544.3c73.5 0 135.2-24.4 180.3-66.3l-88.2-68c-24.5 16.5-55.8 26.3-92.1 26.3-70.8 0-130.8-47.7-152.2-111.6h-90.5v69.9C82.8 485.4 167.9 544.3 272 544.3z"/>
                  <path fill="#FBBC05" d="M119.8 325.9c-10.6-31.5-10.6-65.6 0-97.1v-69.9h-90.5c-39.6 78.1-39.6 170.1 0 248.2l90.5-69.9z"/>
                  <path fill="#EA4335" d="M272 107.1c39.9 0 75.9 13.7 104.2 40.7l78.2-78.2C407.2 24.8 345.5 0 272 0 167.9 0 82.8 58.9 29.3 147.6l90.5 69.9C141.2 154.8 201.2 107.1 272 107.1z"/>
                </svg>
                <span>Create account with Google</span>
              </button>

              <div className="mt-6 text-center text-sm text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="text-[#d4af37] hover:text-[#B8860B] font-medium transition-colors">
                  Sign in
                </Link>
              </div>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
