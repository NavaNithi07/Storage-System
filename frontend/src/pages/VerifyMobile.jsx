import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Phone, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import vibnaLogo from '../components/Vibna.png';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import api from '../services/api';

const VerifyMobile = () => {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // If user already has a mobile number, redirect to appropriate dashboard
  useEffect(() => {
    if (user && user.mobile) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedMobile = mobile.trim();
    if (!trimmedMobile) {
      setError('Please enter your mobile number');
      return;
    }

    // Basic format validation: allow international format + numbers
    const phoneRegex = /^\+?[1-9]\d{1,14}$|^[0-9]{10,12}$/;
    if (!phoneRegex.test(trimmedMobile)) {
      setError('Please enter a valid mobile number (e.g. +919876543210 or 10-digit number)');
      return;
    }

    setLoading(true);
    try {
      // Call endpoint to save mobile number
      const res = await api.post('/auth/save-mobile', { mobile: trimmedMobile });
      
      // Update local storage and AuthContext user state
      updateUser(res.data);
      setSuccess(true);

      // Redirect to correct page based on role
      setTimeout(() => {
        if (res.data.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }, 1000);
    } catch (err) {
      let msg = 'Failed to link mobile number';
      if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-black text-[#F5F5F5] overflow-hidden relative">
      <style>{`
        @keyframes streakMove1 {
          0% { transform: translate(-30%, -20%) rotate(-35deg); opacity: 0.03; }
          50% { transform: translate(-10%, 10%) rotate(-35deg); opacity: 0.12; }
          100% { transform: translate(-30%, -20%) rotate(-35deg); opacity: 0.03; }
        }
        @keyframes cardGlow {
          0%, 100% { box-shadow: 0 0 40px rgba(212, 164, 55, 0.04); }
          50% { box-shadow: 0 0 60px rgba(212, 164, 55, 0.10); }
        }
      `}</style>

      {/* Decorative Moving Background */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute top-0 left-0 w-[500px] h-[700px] bg-gradient-to-b from-transparent via-[#d4af37]/10 to-transparent blur-[120px] pointer-events-none"
          style={{ animation: 'streakMove1 22s infinite ease-in-out' }}
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.06, 0.12, 0.06] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-[#B8860B] blur-[150px] mix-blend-screen"
        />
      </div>

      <div className="w-full flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <Card 
            className="bg-[#0A0A0A]/90 border-[#d4af37]/20 backdrop-blur-2xl p-8 rounded-3xl"
            style={{ animation: 'cardGlow 8s infinite ease-in-out' }}
          >
            {/* Header / Logo */}
            <div className="flex flex-col items-center mb-8">
              <motion.img 
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                src={vibnaLogo} 
                alt="VIBNA Storage" 
                className="w-20 h-20 object-contain mix-blend-screen drop-shadow-[0_0_15px_rgba(212,164,55,0.3)] mb-4" 
              />
              <h2 className="text-2xl font-black tracking-wider text-white">LINK MOBILE NUMBER</h2>
              <p className="text-slate-400 text-xs mt-2 text-center max-w-[280px]">
                To secure your account, VIBNA requires one unique mobile number per storage vault.
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3"
              >
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-300 font-medium leading-relaxed">{error}</p>
              </motion.div>
            )}

            {/* Success Notification */}
            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3"
              >
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-300 font-medium leading-relaxed">
                  Mobile number verified and linked! Preparing your secure storage...
                </p>
              </motion.div>
            )}

            {/* Mobile Collection Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                  Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <Phone className="w-5 h-5" />
                  </span>
                  <Input
                    type="tel"
                    placeholder="+919876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    disabled={loading || success}
                    className="w-full bg-[#111111]/80 border-white/5 focus:border-[#d4af37]/50 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder-slate-600 transition-all font-medium text-sm focus:ring-1 focus:ring-[#d4af37]/20"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || success}
                className="w-full relative overflow-hidden group py-3.5 rounded-2xl bg-gradient-to-r from-[#D4A437] to-[#B8860B] hover:from-[#E5B548] hover:to-[#C9971C] text-black font-extrabold tracking-widest text-xs uppercase transition-all duration-300 flex items-center justify-center gap-2 border-none shadow-[0_4px_20px_rgba(212,164,55,0.25)]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : (
                  <>
                    Verify &amp; Link
                    <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default VerifyMobile;
