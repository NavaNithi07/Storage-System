import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import api from '../services/api';
import vibnaLogo from '../components/Vibna.png';


export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email') || '';
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState(emailParam);
  const [resendStatus, setResendStatus] = useState(''); // '', 'loading', 'success', 'error'
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      queueMicrotask(() => {
        setStatus('error');
        setMessage('Invalid or missing verification token.');
      });
      return;
    }


    const verify = async () => {
      try {
        const res = await api.get(`/auth/verify-email?token=${token}`);
        setStatus('success');
        setMessage(res.data.message || 'Your email has been successfully verified.');
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed. The token may be invalid or expired.');
      }
    };

    verify();
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResendStatus('loading');
    try {
      const res = await api.post('/auth/resend-verification', { email: resendEmail });
      setResendStatus('success');
      setMessage(res.data.message || 'Verification email resent successfully.');
    } catch (err) {
      setResendStatus('error');
      setMessage(err.response?.data?.message || 'Failed to resend verification email.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#F5F5F5] flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-md bg-[#111111]/80 border border-[#d4af37]/20 backdrop-blur-xl p-8 rounded-3xl shadow-[0_0_50px_rgba(212,164,55,0.15)] flex flex-col items-center">
        <div className="flex items-center gap-3 mb-8">
          <img src={vibnaLogo} alt="Vibna logo" className="w-12 h-12 object-contain mix-blend-screen drop-shadow-[0_0_10px_rgba(212,164,55,0.3)]" />
          <span className="text-2xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#d4af37]">
            VIBNA
          </span>
        </div>

        {status === 'verifying' && (
          <div className="text-center py-6 flex flex-col items-center gap-4">
            <Loader2 className="w-16 h-16 text-[#d4af37] animate-spin" />
            <h2 className="text-xl font-semibold">Verifying your email...</h2>
            <p className="text-slate-400 text-sm">Please hold on while we process your request.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-6 flex flex-col items-center gap-4 w-full">
            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            <h2 className="text-2xl font-bold text-white">Email Verified!</h2>
            <p className="text-slate-300 text-sm px-4">{message}</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-6 w-full py-3 px-6 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-black font-bold hover:shadow-[0_0_20px_rgba(212,164,55,0.4)] transition-all duration-300 transform hover:-translate-y-0.5"
            >
              Go to Login
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-6 flex flex-col items-center gap-4 w-full">
            <XCircle className="w-16 h-16 text-rose-500" />
            <h2 className="text-2xl font-bold text-white">Verification Failed</h2>
            <p className="text-rose-300 text-sm px-4">{message}</p>

            <hr className="w-full border-t border-[#d4af37]/10 my-4" />

            <form onSubmit={handleResend} className="w-full text-left">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Resend Verification Email
              </label>
              <div className="relative flex items-center mb-4">
                <Mail className="absolute left-4 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-black/60 border border-[#d4af37]/20 rounded-xl focus:border-[#d4af37] focus:outline-none text-white text-sm transition-all placeholder:text-slate-600"
                />
              </div>
              <button
                type="submit"
                disabled={resendStatus === 'loading'}
                className="w-full py-3 rounded-xl bg-transparent border border-[#d4af37] text-[#d4af37] font-semibold hover:bg-[#d4af37] hover:text-black transition-all duration-300 flex justify-center items-center gap-2"
              >
                {resendStatus === 'loading' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : 'Resend Verification Link'}
              </button>
            </form>

            <Link to="/login" className="text-[#d4af37] text-sm hover:underline mt-4 inline-block">
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
