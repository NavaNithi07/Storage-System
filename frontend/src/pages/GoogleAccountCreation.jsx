import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

// ─── Step configurations ──────────────────────────────────────────────────────
const STEPS = ['name', 'basicInfo', 'chooseEmail', 'password', 'phone', 'review'];
const STEP_TITLES = {
  name: 'Create your Vibna Account',
  basicInfo: 'Basic information',
  chooseEmail: 'Choose your Vibna address',
  password: 'Create a strong password',
  phone: 'Add phone number',
  review: 'Review your account info',
};
const STEP_SUBTITLES = {
  name: 'Enter your name',
  basicInfo: 'Enter your birthday and gender',
  chooseEmail: 'Choose a Vibna Storage address or create your own',
  password: "Use 8 or more characters with a mix of letters, numbers & symbols",
  phone: 'For account recovery (optional)',
  review: 'Confirm your details and create your account',
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── Component ────────────────────────────────────────────────────────────────
const GoogleAccountCreation = () => {
  const { registerVibnaAccount } = useContext(AuthContext);
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [emailChoice, setEmailChoice] = useState('suggested'); // 'suggested' | 'custom'
  const [selectedEmail, setSelectedEmail] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [emailAvailable, setEmailAvailable] = useState(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [createdAccount, setCreatedAccount] = useState(null);

  // Generate email suggestions from name, memoized to prevent random number changing on re-renders
  const suggestions = useMemo(() => {
    if (!firstName.trim() || !lastName.trim()) return [];
    const f = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const l = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const year = new Date().getFullYear() % 100;
    return [
      `${f}.${l}`,
      `${f}${l}${rand}`,
      `${f}.${l}${year}`,
      `${l}.${f}`,
    ].map(h => `${h}@vibna.storage`);
  }, [firstName, lastName]);

  useEffect(() => {
    if (suggestions.length > 0 && !selectedEmail) {
      setSelectedEmail(suggestions[0]);
    }
  }, [firstName, lastName]);

  const checkEmail = useCallback(async (email) => {
    if (!email || !email.endsWith('@vibna.storage')) {
      setEmailAvailable(null);
      return;
    }
    const handle = email.split('@')[0];
    if (handle.length < 3) {
      setEmailAvailable(null);
      return;
    }
    setEmailChecking(true);
    try {
      const res = await api.post('/auth/check-vibna-email', { email });
      setEmailAvailable(res.data.available);
      if (!res.data.available) {
        setError(res.data.message || 'This email is already taken');
      } else {
        setError('');
      }
    } catch (err) {
      setEmailAvailable(null);
      setError(err.response?.data?.message || 'Error checking email availability');
    } finally {
      setEmailChecking(false);
    }
  }, []);

  useEffect(() => {
    if (emailChoice === 'custom' && customEmail) {
      const full = customEmail.includes('@vibna.storage') ? customEmail : `${customEmail}@vibna.storage`;
      const timer = setTimeout(() => checkEmail(full), 400);
      return () => clearTimeout(timer);
    }
  }, [customEmail, emailChoice, checkEmail]);

  const passChecks = {
    minLen: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNum: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    matches: password && password === confirmPassword,
  };
  const isPassValid = Object.values(passChecks).every(Boolean);

  const canProceed = () => {
    switch (STEPS[currentStep]) {
      case 'name':
        return firstName.trim().length >= 1 && lastName.trim().length >= 1;
      case 'basicInfo':
        return birthMonth && birthDay && birthYear && gender;
      case 'chooseEmail':
        if (emailChoice === 'suggested') return Boolean(selectedEmail);
        if (emailChoice === 'custom') {
          const handle = customEmail.replace(/@vibna\.storage$/, '');
          return handle.length >= 3 && /^[a-z0-9._]+$/.test(handle) && emailAvailable === true;
        }
        return false;
      case 'password':
        return isPassValid;
      case 'phone':
        return true;
      case 'review':
        return agreedToTerms;
      default:
        return false;
    }
  };

  const finalEmail = emailChoice === 'custom'
    ? (customEmail.endsWith('@vibna.storage') ? customEmail : `${customEmail}@vibna.storage`)
    : selectedEmail;

  const goNext = () => {
    setError('');
    if (canProceed() && currentStep < STEPS.length - 1) {
      setDirection(1);
      setCurrentStep(s => s + 1);
    }
  };

  const goBack = () => {
    setError('');
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(s => s - 1);
    } else {
      navigate('/register');
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) return;
    setLoading(true);
    setError('');
    try {
      let bDate = null;
      if (birthMonth && birthDay && birthYear) {
        const mIdx = MONTHS.indexOf(birthMonth);
        if (mIdx >= 0) {
          bDate = new Date(parseInt(birthYear), mIdx, parseInt(birthDay)).toISOString();
        }
      }

      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        vibnaEmail: finalEmail,
        password,
        confirmPassword,
        birthday: bDate,
        gender,
        phone: phone.trim() || undefined,
      };

      const user = await registerVibnaAccount(payload);
      setCreatedAccount({ ...user, email: finalEmail, password });
      setCurrentStep(STEPS.length); // Success screen
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Account creation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  // ─── Render Success Screen ──────────────────────────────────────────────────
  if (createdAccount) {
    return (
      <div style={styles.page}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={styles.card}
        >
          <div style={styles.logoWrap}>
            <VibnaGLogo />
          </div>

          <div style={{ textAlign: 'center', margin: '24px 0 16px' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(52, 168, 83, 0.15)',
              border: '1px solid rgba(52, 168, 83, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34a853" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F5', margin: '0 0 8px' }}>
              Welcome to Vibna Storage!
            </h1>
            <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>
              Your account has been created successfully.
            </p>
          </div>

          <div style={{
            background: '#0A0A0A',
            borderRadius: 12,
            padding: 20,
            margin: '20px 0',
            border: '1px solid rgba(212, 164, 55, 0.2)',
          }}>
            <div style={{ fontSize: 12, color: '#D4A437', fontWeight: 600, textTransform: 'uppercase', tracking: '0.05em', marginBottom: 12 }}>
              Your Account Details
            </div>
            <div style={styles.reviewRow}>
              <span style={styles.reviewLabel}>Name</span>
              <span style={styles.reviewValue}>{createdAccount.name}</span>
            </div>
            <div style={styles.reviewRow}>
              <span style={styles.reviewLabel}>Vibna Email</span>
              <span style={{ ...styles.reviewValue, color: '#D4A437', fontFamily: 'monospace', fontWeight: 700 }}>
                {createdAccount.vibnaEmail || createdAccount.email}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard', { replace: true })}
            style={styles.btnNextFull}
          >
            Continue to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // ─── Render Step Content ───────────────────────────────────────────────────
  const renderStep = () => {
    switch (STEPS[currentStep]) {
      case 'name':
        return (
          <div style={styles.fieldsWrap}>
            <div>
              <label style={styles.label}>First name</label>
              <input
                style={styles.input}
                type="text"
                value={firstName}
                onChange={e => { setFirstName(e.target.value); setError(''); }}
                placeholder="Enter first name"
                autoFocus
              />
            </div>
            <div>
              <label style={styles.label}>Last name</label>
              <input
                style={styles.input}
                type="text"
                value={lastName}
                onChange={e => { setLastName(e.target.value); setError(''); }}
                placeholder="Enter last name"
              />
            </div>
          </div>
        );

      case 'basicInfo':
        return (
          <div style={styles.fieldsWrap}>
            <div>
              <label style={styles.label}>Birthday</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <select
                  style={{ ...styles.input, flex: 2, cursor: 'pointer', appearance: 'auto' }}
                  value={birthMonth}
                  onChange={e => setBirthMonth(e.target.value)}
                >
                  <option value="" style={{ background: '#111', color: '#F5F5F5' }}>Month</option>
                  {MONTHS.map(m => <option key={m} value={m} style={{ background: '#111', color: '#F5F5F5' }}>{m}</option>)}
                </select>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  type="number"
                  value={birthDay}
                  onChange={e => setBirthDay(e.target.value)}
                  placeholder="Day"
                  min="1"
                  max="31"
                />
                <input
                  style={{ ...styles.input, flex: 1.2 }}
                  type="number"
                  value={birthYear}
                  onChange={e => setBirthYear(e.target.value)}
                  placeholder="Year"
                  min="1900"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
            <div>
              <label style={styles.label}>Gender</label>
              <select
                style={{ ...styles.input, cursor: 'pointer', appearance: 'auto' }}
                value={gender}
                onChange={e => setGender(e.target.value)}
              >
                <option value="" style={{ background: '#111', color: '#F5F5F5' }}>Select</option>
                <option value="male" style={{ background: '#111', color: '#F5F5F5' }}>Male</option>
                <option value="female" style={{ background: '#111', color: '#F5F5F5' }}>Female</option>
                <option value="other" style={{ background: '#111', color: '#F5F5F5' }}>Rather not say</option>
              </select>
            </div>
          </div>
        );

      case 'chooseEmail':
        return (
          <div style={styles.fieldsWrap}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {suggestions.slice(0, 2).map(email => (
                <label
                  key={email}
                  onClick={(e) => { 
                    // Prevent double firing from the label and the radio input
                    e.preventDefault(); 
                    setEmailChoice('suggested'); 
                    setSelectedEmail(email); 
                    setError(''); 
                  }}
                  style={{
                    ...styles.radioOption,
                    borderColor: emailChoice === 'suggested' && selectedEmail === email ? '#D4A437' : '#1A1A1A',
                    background: emailChoice === 'suggested' && selectedEmail === email ? 'rgba(212, 164, 55, 0.12)' : '#0A0A0A',
                  }}
                >
                  <input
                    type="radio"
                    name="emailChoice"
                    checked={emailChoice === 'suggested' && selectedEmail === email}
                    onChange={() => { setEmailChoice('suggested'); setSelectedEmail(email); setError(''); }}
                    style={{ accentColor: '#D4A437', width: 18, height: 18 }}
                  />
                  <span style={{ fontSize: 14, color: emailChoice === 'suggested' && selectedEmail === email ? '#F5F5F5' : '#D1D5DB', fontWeight: 500 }}>
                    {email}
                  </span>
                </label>
              ))}

              <div
                onClick={() => {
                  if (emailChoice !== 'custom') {
                    setEmailChoice('custom');
                    setError('');
                  }
                }}
                style={{
                  ...styles.radioOption,
                  borderColor: emailChoice === 'custom' ? '#D4A437' : '#1A1A1A',
                  background: emailChoice === 'custom' ? 'rgba(212, 164, 55, 0.12)' : '#0A0A0A',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 10,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="radio"
                    name="emailChoice"
                    checked={emailChoice === 'custom'}
                    onChange={() => { setEmailChoice('custom'); setError(''); }}
                    style={{ accentColor: '#D4A437', width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14, color: emailChoice === 'custom' ? '#F5F5F5' : '#D1D5DB', fontWeight: 500 }}>
                    Create your own Vibna Storage address
                  </span>
                </div>

                {emailChoice === 'custom' && (
                  <div
                    style={{ width: '100%', paddingLeft: 28 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <input
                        style={{ ...styles.input, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none', flex: 1 }}
                        type="text"
                        value={customEmail.replace(/@vibna\.storage$/, '')}
                        onChange={e => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '');
                          setCustomEmail(val);
                          setError('');
                        }}
                        placeholder="your.name"
                        autoFocus
                      />
                      <span style={{
                        padding: '11px 14px',
                        background: '#1A1A1A',
                        border: '1px solid #262626',
                        borderTopRightRadius: 8,
                        borderBottomRightRadius: 8,
                        color: '#D4A437',
                        fontSize: 14,
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                      }}>
                        @vibna.storage
                      </span>
                    </div>
                    {emailChecking && (
                      <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 12, height: 12, border: '2px solid #262626', borderTopColor: '#D4A437', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                        Checking availability...
                      </p>
                    )}
                    {!emailChecking && emailAvailable === true && customEmail.replace(/@vibna\.storage$/, '').length >= 3 && (
                      <p style={{ fontSize: 12, color: '#34a853', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        {customEmail.replace(/@vibna\.storage$/, '')}@vibna.storage is available
                      </p>
                    )}
                    {!emailChecking && emailAvailable === false && (
                      <p style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>This username is already taken. Try another.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'password':
        return (
          <div style={styles.fieldsWrap}>
            <div>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Create password"
                autoFocus
              />
            </div>
            <div>
              <label style={styles.label}>Confirm</label>
              <input
                style={{
                  ...styles.input,
                  borderColor: confirmPassword && !passChecks.matches ? '#f87171' : '#262626',
                }}
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Confirm password"
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#9CA3AF', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={e => setShowPassword(e.target.checked)}
                style={{ accentColor: '#D4A437', width: 16, height: 16 }}
              />
              Show password
            </label>

            {password.length > 0 && (
              <div style={{ background: '#0A0A0A', borderRadius: 8, padding: 12, marginTop: 4, border: '1px solid #1A1A1A' }}>
                {[
                  [passChecks.minLen, 'At least 8 characters'],
                  [passChecks.hasUpper, 'One uppercase letter'],
                  [passChecks.hasLower, 'One lowercase letter'],
                  [passChecks.hasNum, 'One number'],
                  [passChecks.hasSpecial, 'One special character (!@#$...)'],
                ].map(([ok, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 12 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ok ? '#34a853' : '#404040'} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{ color: ok ? '#34a853' : '#737373' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'phone':
        return (
          <div style={styles.fieldsWrap}>
            <div>
              <label style={styles.label}>Phone number (optional)</label>
              <input
                style={styles.input}
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(''); }}
                placeholder="+91 98765 43210"
                autoFocus
              />
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8, lineHeight: 1.5 }}>
                This phone number can be used for account recovery. You can change this later in your account settings.
              </p>
            </div>
          </div>
        );

      case 'review':
        return (
          <div style={styles.fieldsWrap}>
            <div style={{ background: '#0A0A0A', borderRadius: 12, padding: 16, border: '1px solid rgba(212, 164, 55, 0.2)' }}>
              <div style={styles.reviewRow}>
                <span style={styles.reviewLabel}>Name</span>
                <span style={styles.reviewValue}>{firstName} {lastName}</span>
              </div>
              <div style={styles.reviewRow}>
                <span style={styles.reviewLabel}>Vibna Email</span>
                <span style={{ ...styles.reviewValue, color: '#D4A437', fontFamily: 'monospace', fontSize: 13 }}>{finalEmail}</span>
              </div>
              {(birthMonth || gender) && (
                <div style={styles.reviewRow}>
                  <span style={styles.reviewLabel}>Personal</span>
                  <span style={styles.reviewValue}>
                    {birthMonth && `${birthMonth} ${birthDay}, ${birthYear}`}
                    {birthMonth && gender && ' · '}
                    {gender && gender.charAt(0).toUpperCase() + gender.slice(1)}
                  </span>
                </div>
              )}
              {phone && (
                <div style={styles.reviewRow}>
                  <span style={styles.reviewLabel}>Phone</span>
                  <span style={styles.reviewValue}>{phone}</span>
                </div>
              )}
            </div>

            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              cursor: 'pointer',
              fontSize: 13,
              color: '#9CA3AF',
              lineHeight: 1.5,
              userSelect: 'none',
              marginTop: 8,
            }}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                style={{ accentColor: '#D4A437', width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
              />
              <span>
                I agree to the <span style={{ color: '#D4A437', fontWeight: 500 }}>Vibna Storage Terms of Service</span> and <span style={{ color: '#D4A437', fontWeight: 500 }}>Privacy Policy</span>. I understand that a Vibna Storage email will be created for me to access this application.
              </span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  const stepKey = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <VibnaGLogo />
        </div>

        <h1 style={styles.title}>{STEP_TITLES[stepKey]}</h1>
        <p style={styles.subtitle}>{STEP_SUBTITLES[stepKey]}</p>

        <div style={styles.progressWrap}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.progressDot,
                background: i <= currentStep ? '#D4A437' : '#262626',
                width: i === currentStep ? 24 : 8,
                borderRadius: i === currentStep ? 4 : '50%',
              }}
            />
          ))}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={styles.errorBanner}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{error}</span>
          </motion.div>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepKey}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        <div style={styles.btnRow}>
          <button
            type="button"
            onClick={goBack}
            style={styles.btnBack}
          >
            {currentStep === 0 ? 'Back to Register' : 'Back'}
          </button>

          {isLastStep ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed() || loading}
              style={{
                ...styles.btnNext,
                opacity: (!canProceed() || loading) ? 0.6 : 1,
                cursor: (!canProceed() || loading) ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={!canProceed()}
              style={{
                ...styles.btnNext,
                opacity: canProceed() ? 1 : 0.6,
                cursor: canProceed() ? 'pointer' : 'not-allowed',
              }}
            >
              Next
            </button>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#9CA3AF' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#D4A437', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ─── Vibna Logo Header ───────────────────────────────────────────────────────
const VibnaGLogo = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
    <svg width="42" height="42" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.66 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.66 48 24 48z"/>
    </svg>
    <span style={{
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: '0.15em',
      color: '#D4A437',
      fontFamily: "'Google Sans', Roboto, sans-serif",
    }}>
      VIBNA STORAGE
    </span>
  </div>
);

// ─── Inline Styles (VIBNA Dark Premium Gold Aesthetic) ────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000000',
    backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(212, 164, 55, 0.15) 0%, transparent 60%)',
    padding: 20,
    fontFamily: "'Google Sans', 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    width: '100%',
    maxWidth: 460,
    background: '#111111',
    borderRadius: 20,
    padding: '40px 36px 32px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 30px rgba(212,164,55,0.08)',
    border: '1px solid rgba(212, 164, 55, 0.25)',
  },
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    color: '#F5F5F5',
    textAlign: 'center',
    margin: '0 0 6px',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    margin: '0 0 20px',
    lineHeight: 1.5,
  },
  progressWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  progressDot: {
    height: 8,
    transition: 'all 0.3s ease',
  },
  fieldsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minHeight: 140,
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
    transition: 'all 0.2s',
    background: '#0A0A0A',
    boxSizing: 'border-box',
  },
  radioOption: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    border: '1px solid #1A1A1A',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  btnRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
  },
  btnBack: {
    padding: '11px 20px',
    border: 'none',
    background: 'transparent',
    color: '#D4A437',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: 10,
    transition: 'all 0.2s',
  },
  btnNext: {
    padding: '11px 28px',
    border: 'none',
    background: 'linear-gradient(135deg, #D4A437 0%, #B8860B 100%)',
    color: '#000000',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: 10,
    transition: 'all 0.2s',
    boxShadow: '0 4px 15px rgba(212, 164, 55, 0.3)',
  },
  btnNextFull: {
    width: '100%',
    padding: '13px 28px',
    border: 'none',
    background: 'linear-gradient(135deg, #D4A437 0%, #B8860B 100%)',
    color: '#000000',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: 10,
    transition: 'all 0.2s',
    boxShadow: '0 4px 20px rgba(212, 164, 55, 0.4)',
    marginTop: 8,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: 'rgba(225, 29, 72, 0.15)',
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 13,
    color: '#f87171',
    border: '1px solid rgba(225, 29, 72, 0.3)',
  },
  reviewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewLabel: {
    fontSize: 12,
    color: '#D4A437',
    fontWeight: 600,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: 500,
    color: '#F5F5F5',
  },
};

export default GoogleAccountCreation;
