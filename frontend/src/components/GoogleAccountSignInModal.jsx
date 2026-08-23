import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Helper to manage saved accounts in localStorage
const getSavedAccounts = () => {
  try {
    const raw = localStorage.getItem('vibna_saved_accounts');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveAccount = (name, email, password) => {
  try {
    const list = getSavedAccounts();
    const updated = list.filter(acc => acc.email.toLowerCase() !== email.toLowerCase());
    updated.unshift({ name: name || email.split('@')[0], email, password, lastUsed: new Date().toISOString() });
    localStorage.setItem('vibna_saved_accounts', JSON.stringify(updated.slice(0, 5)));
  } catch (err) {}
};

const removeAccount = (email) => {
  try {
    const list = getSavedAccounts();
    const updated = list.filter(acc => acc.email.toLowerCase() !== email.toLowerCase());
    localStorage.setItem('vibna_saved_accounts', JSON.stringify(updated));
  } catch (err) {}
};

const GoogleAccountSignInModal = ({ isOpen, onClose }) => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [savedAccounts, setSavedAccounts] = useState([]);
  const [step, setStep] = useState('email'); // 'choose_account' | 'email' | 'password' | 'success'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const accounts = getSavedAccounts();
      setSavedAccounts(accounts);
      if (accounts.length > 0) {
        setStep('choose_account');
      } else {
        setStep('email');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resetState = () => {
    const accounts = getSavedAccounts();
    setSavedAccounts(accounts);
    setStep(accounts.length > 0 ? 'choose_account' : 'email');
    setIdentifier('');
    setPassword('');
    setError('');
    setLoading(false);
    setShowPassword(false);
    setLoggedInUser(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSelectSavedAccount = async (account) => {
    setIdentifier(account.email);
    if (account.password) {
      setPassword(account.password);
      setLoading(true);
      setError('');
      try {
        const userData = await login(account.email, account.password);
        saveAccount(userData.name || account.name, account.email, account.password);
        setLoggedInUser(userData);
        setStep('success');
        setLoading(false);
        setTimeout(() => {
          handleClose();
          if (userData.role === 'admin') {
            navigate('/admin/dashboard', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }, 1600);
        return;
      } catch (err) {
        setLoading(false);
        setStep('password');
        setError(err.response?.data?.message || 'Saved password expired. Please enter password.');
      }
    } else {
      setStep('password');
    }
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    setError('');
    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId) {
      setError('Enter an email or username');
      return;
    }
    const fullEmail = cleanId.includes('@') ? cleanId : `${cleanId}@vibna.storage`;
    setIdentifier(fullEmail);

    const savedMatch = savedAccounts.find(a => a.email.toLowerCase() === fullEmail);
    if (savedMatch && savedMatch.password) {
      setPassword(savedMatch.password);
    }
    setStep('password');
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError('Enter your password');
      return;
    }
    setLoading(true);
    try {
      const userData = await login(identifier, password);
      saveAccount(userData.name, userData.email || identifier, password);
      setLoggedInUser(userData);
      setStep('success');
      setLoading(false);
      setTimeout(() => {
        handleClose();
        if (userData.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }, 1600);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.message || err.message || 'Invalid login details');
    }
  };

  const handleRemoveSavedAccount = (e, email) => {
    e.stopPropagation();
    removeAccount(email);
    const updated = savedAccounts.filter(a => a.email.toLowerCase() !== email.toLowerCase());
    setSavedAccounts(updated);
    if (updated.length === 0) setStep('email');
  };

  return (
    <AnimatePresence>
      <div style={styles.overlay} onClick={handleClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          style={styles.modalCard}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={styles.logoRow}>
            <VibnaGLogo />
            <button type="button" onClick={handleClose} style={styles.closeBtn} aria-label="Close">
              ✕
            </button>
          </div>

          {/* SUCCESS STEP */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={styles.successIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34a853" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ ...styles.title, color: '#F5F5F5' }}>Signed in successfully</h2>
              <p style={{ ...styles.subtitle, color: '#9CA3AF' }}>Welcome back, {loggedInUser?.name || 'User'}!</p>
              <div style={styles.userBadge}>
                <span style={{ fontSize: 13, color: '#D4A437', fontWeight: 600, fontFamily: 'monospace' }}>
                  {loggedInUser?.vibnaEmail || loggedInUser?.email || identifier}
                </span>
              </div>
            </div>
          )}

          {/* CHOOSE SAVED ACCOUNT STEP */}
          {step === 'choose_account' && (
            <div>
              <h2 style={styles.title}>Choose an account</h2>
              <p style={styles.subtitle}>to continue to Vibna Storage</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {savedAccounts.map((acc) => (
                  <div
                    key={acc.email}
                    onClick={() => handleSelectSavedAccount(acc)}
                    style={styles.accountRow}
                  >
                    <div style={styles.avatarCircle}>
                      {acc.name ? acc.name.charAt(0).toUpperCase() : acc.email.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F5F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {acc.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {acc.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveSavedAccount(e, acc.email)}
                      style={styles.removeBtn}
                      title="Remove account from device"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => { setStep('email'); setIdentifier(''); }}
                style={styles.useAnotherBtn}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Use another account
              </button>
            </div>
          )}

          {/* ENTER EMAIL STEP */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit}>
              <h2 style={styles.title}>Sign in</h2>
              <p style={styles.subtitle}>with your Vibna Account</p>

              {error && (
                <div style={styles.errorBox}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={styles.label}>Email or username</label>
                <input
                  style={styles.input}
                  type="text"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setError(''); }}
                  placeholder="your.name@vibna.storage"
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    navigate('/google-create-account');
                  }}
                  style={styles.linkBtn}
                >
                  Create account
                </button>
                <button
                  type="submit"
                  style={styles.primaryBtn}
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* ENTER PASSWORD STEP */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit}>
              <div
                onClick={() => setStep(savedAccounts.length > 0 ? 'choose_account' : 'email')}
                style={styles.accountPill}
              >
                <div style={styles.userAvatarIcon}>
                  {identifier.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: '#F5F5F5', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {identifier}
                </span>
                <span style={{ fontSize: 12, color: '#D4A437' }}>Change</span>
              </div>

              <h2 style={styles.title}>Welcome back</h2>
              <p style={styles.subtitle}>Enter your password to sign in</p>

              {error && (
                <div style={styles.errorBox}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={styles.label}>Enter your password</label>
                <input
                  style={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Password"
                  autoFocus
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#9CA3AF', userSelect: 'none', marginBottom: 20 }}>
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={e => setShowPassword(e.target.checked)}
                  style={{ accentColor: '#D4A437', width: 16, height: 16 }}
                />
                Show password
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); }}
                  style={styles.linkBtn}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ ...styles.primaryBtn, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// Vibna Google-styled logo
const VibnaGLogo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <svg width="32" height="32" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.66 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.66 48 24 48z"/>
    </svg>
    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', color: '#D4A437', fontFamily: "'Google Sans', Roboto, sans-serif" }}>
      VIBNA STORAGE
    </span>
  </div>
);

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    background: '#111111',
    borderRadius: 20,
    padding: '32px 36px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 30px rgba(212,164,55,0.1)',
    border: '1px solid rgba(212, 164, 55, 0.25)',
    fontFamily: "'Google Sans', 'Segoe UI', Roboto, sans-serif",
  },
  logoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    color: '#9CA3AF',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '50%',
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    color: '#F5F5F5',
    margin: '0 0 4px',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    margin: '0 0 20px',
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#D4A437',
    marginBottom: 6,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #262626',
    borderRadius: 10,
    fontSize: 14,
    color: '#F5F5F5',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#0A0A0A',
  },
  primaryBtn: {
    padding: '11px 26px',
    background: 'linear-gradient(135deg, #D4A437 0%, #B8860B 100%)',
    color: '#000000',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(212, 164, 55, 0.3)',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#D4A437',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    background: 'rgba(225, 29, 72, 0.15)',
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 13,
    color: '#f87171',
    border: '1px solid rgba(225, 29, 72, 0.3)',
  },
  accountPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 14px',
    border: '1px solid rgba(212, 164, 55, 0.2)',
    borderRadius: 20,
    cursor: 'pointer',
    marginBottom: 20,
    background: '#0A0A0A',
  },
  userAvatarIcon: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #D4A437 0%, #B8860B 100%)',
    color: '#000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    background: 'rgba(52, 168, 83, 0.15)',
    border: '1px solid rgba(52, 168, 83, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  userBadge: {
    display: 'inline-block',
    padding: '6px 16px',
    background: '#0A0A0A',
    border: '1px solid rgba(212, 164, 55, 0.3)',
    borderRadius: 20,
    marginTop: 12,
  },
  accountRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    border: '1px solid #1A1A1A',
    borderRadius: 12,
    background: '#0A0A0A',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #D4A437 0%, #B8860B 100%)',
    color: '#000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 700,
    flexShrink: 0,
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#737373',
    fontSize: 14,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '50%',
  },
  useAnotherBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'none',
    border: 'none',
    color: '#D4A437',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
};

export default GoogleAccountSignInModal;
