import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  Lock, 
  CloudUpload, 
  Zap, 
  Eye, 
  Download, 
  Share2, 
  HardDrive, 
  ArrowRight, 
  FileText, 
  Folder,
  BarChart3,
  Clock,
  Key,
  Globe,
  UserCheck,
  Search,
  Send,
  Sparkles,
  FileCode,
  Image as ImageIcon,
  Video,
  Music,
  Sliders,
  CheckCircle2,
  Users,
  Shield,
  Layers,
  ChevronRight,
  Star,
  Trash2
} from 'lucide-react';
import vibnaLogo from '../components/Vibna.png';
import { AuthContext } from '../context/AuthContext';

export default function Landing() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [emailInput, setEmailInput] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!emailInput) return;
    setSubscribed(true);
    setTimeout(() => {
      setSubscribed(false);
      setEmailInput('');
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#d4af37]/30 selection:text-[#d4af37] font-sans overflow-x-hidden">
      {/* Background Subtle Mesh & Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-gradient-to-br from-[#d4af37]/10 via-[#b8860b]/5 to-transparent rounded-full blur-[150px] opacity-60" />
        <div className="absolute top-1/3 -right-32 w-[650px] h-[650px] bg-gradient-to-br from-[#f3e5ab]/10 via-[#d4af37]/5 to-transparent rounded-full blur-[160px] opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:40px_40px] opacity-[0.02]" />
      </div>

      {/* ─── 1. NAVBAR ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#050505]/85 border-b border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-[#111111] border border-[#d4af37]/40 flex items-center justify-center p-1.5 shadow-[0_0_20px_rgba(212,164,55,0.25)] group-hover:scale-105 transition-transform">
              <img src={vibnaLogo} alt="VIBNA Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-xl tracking-wider text-white flex items-center gap-1.5">
              VIBNA <span className="text-[#d4af37]">STORAGE</span>
            </span>
          </Link>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#home" className="text-white hover:text-[#d4af37] transition-colors border-b-2 border-[#d4af37] pb-1">Home</a>
            <a href="#features" className="hover:text-[#d4af37] transition-colors">Features</a>
            <a href="#security" className="hover:text-[#d4af37] transition-colors">Security</a>
            <a href="#how-it-works" className="hover:text-[#d4af37] transition-colors">How It Works</a>
            <a href="#about" className="hover:text-[#d4af37] transition-colors">About</a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to={user.role === 'admin' ? '/admin/dashboard' : '/dashboard'}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-black font-extrabold text-sm shadow-[0_0_25px_rgba(212,164,55,0.4)] hover:brightness-110 transition-all flex items-center gap-2"
              >
                <span>Dashboard</span>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-5 py-2 rounded-full border border-white/20 text-sm font-bold text-white hover:bg-white/10 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-6 py-2.5 rounded-full bg-[#d4af37] hover:bg-[#e5b548] text-black font-extrabold text-sm shadow-[0_0_20px_rgba(212,164,55,0.35)] transition-all flex items-center gap-1.5"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── 2. HERO SECTION ─────────────────────────────────────────────────── */}
      <section id="home" className="relative z-10 pt-16 pb-20 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Text Column */}
          <div className="lg:col-span-6 flex flex-col items-start text-left">
            {/* Security Pill */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-[#161616] border border-[#d4af37]/40 text-[11px] font-bold text-[#d4af37] uppercase tracking-wider mb-6 shadow-sm"
            >
              <Shield size={13} className="text-[#d4af37]" />
              <span>SECURE. RELIABLE. ALWAYS ACCESSIBLE</span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.12]"
            >
              Your Files.<br />
              <span className="text-[#d4af37]">Securely Stored.</span><br />
              Always Within Reach.
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-6 text-slate-300 text-base sm:text-lg font-light leading-relaxed max-w-xl"
            >
              VIBNA Storage provides secure cloud storage to upload, organize, preview, manage, and share your files from anywhere.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <Link
                to="/register"
                className="px-7 py-3.5 rounded-lg bg-[#d4af37] hover:bg-[#e5b548] text-black font-extrabold text-sm shadow-[0_0_30px_rgba(212,164,55,0.35)] transition-all flex items-center gap-2"
              >
                <span>Get Started</span>
                <ArrowRight size={18} />
              </Link>
              <a
                href="#features"
                className="px-7 py-3.5 rounded-lg bg-[#111111] border border-white/20 hover:bg-[#1a1a1a] text-white font-bold text-sm transition-all"
              >
                Explore Features
              </a>
            </motion.div>

            {/* Social Proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-10 flex items-center gap-3 pt-6 border-t border-white/10 w-full"
            >
              <div className="flex -space-x-2 overflow-hidden">
                <img className="inline-block h-8 w-8 rounded-full ring-2 ring-black" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" alt="User 1" />
                <img className="inline-block h-8 w-8 rounded-full ring-2 ring-black" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" alt="User 2" />
                <img className="inline-block h-8 w-8 rounded-full ring-2 ring-black" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" alt="User 3" />
              </div>
              <span className="text-xs text-slate-400 font-medium">Trusted by thousands of users</span>
            </motion.div>
          </div>

          {/* Right Hero App Preview Graphic Column */}
          <div className="lg:col-span-6 relative flex items-center justify-center">
            {/* Main App Glass Card Mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-full rounded-2xl bg-[#0D0D0D] border border-white/15 p-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative z-10"
            >
              {/* App Search Bar */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#161616] border border-[#d4af37]/40 flex items-center justify-center p-1">
                    <img src={vibnaLogo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <span className="font-bold text-white tracking-wide">VIBNA STORAGE</span>
                </div>
                <div className="flex-1 max-w-[200px] mx-4 relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input readOnly value="Search" className="w-full bg-[#161616] border border-white/10 rounded-md pl-7 pr-2 py-1 text-[11px] text-slate-400 focus:outline-none" />
                </div>
                <div className="w-6 h-6 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center text-[10px] font-bold text-[#d4af37]">
                  JD
                </div>
              </div>

              {/* Layout Sidebar + Grid */}
              <div className="grid grid-cols-12 gap-4">
                {/* Left Mini Sidebar */}
                <div className="col-span-3 bg-[#111111] rounded-xl p-3 border border-white/5 space-y-2 text-[11px]">
                  <div className="px-2 py-1.5 rounded-lg bg-[#d4af37] text-black font-bold flex items-center gap-1.5">
                    <Folder size={12} /> My Files
                  </div>
                  <div className="px-2 py-1 text-slate-400 flex items-center gap-1.5">
                    <Clock size={12} /> Recent
                  </div>
                  <div className="px-2 py-1 text-slate-400 flex items-center gap-1.5">
                    <Share2 size={12} /> Shared
                  </div>
                  <div className="px-2 py-1 text-slate-400 flex items-center gap-1.5">
                    <Star size={12} /> Favorites
                  </div>
                  <div className="px-2 py-1 text-slate-400 flex items-center gap-1.5">
                    <Trash2 size={12} /> Trash
                  </div>

                  <div className="pt-3 border-t border-white/10">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Storage</span>
                      <span className="text-white font-bold">68%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[#d4af37] h-full w-[68%]" />
                    </div>
                    <div className="text-[9px] text-slate-500 mt-1">6.8 GB / 10 GB</div>
                  </div>
                </div>

                {/* Right Files Grid */}
                <div className="col-span-9 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">My Files</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Item 1 */}
                    <div className="p-2.5 rounded-xl bg-[#141414] border border-white/10 hover:border-[#d4af37]/40 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center mb-1.5">
                        <FileText size={16} />
                      </div>
                      <span className="text-[10px] font-bold text-white truncate w-full">Project Proposal</span>
                      <span className="text-[8px] text-slate-500">PDF • 2.4 MB</span>
                    </div>

                    {/* Item 2 */}
                    <div className="p-2.5 rounded-xl bg-[#141414] border border-white/10 hover:border-[#d4af37]/40 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center mb-1.5">
                        <ImageIcon size={16} />
                      </div>
                      <span className="text-[10px] font-bold text-white truncate w-full">Dashboard Design</span>
                      <span className="text-[8px] text-slate-500">Figma • 12.5 MB</span>
                    </div>

                    {/* Item 3 */}
                    <div className="p-2.5 rounded-xl bg-[#141414] border border-white/10 hover:border-[#d4af37]/40 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mb-1.5">
                        <Video size={16} />
                      </div>
                      <span className="text-[10px] font-bold text-white truncate w-full">Product Video</span>
                      <span className="text-[8px] text-slate-500">MP4 • 48.2 MB</span>
                    </div>

                    {/* Item 4 */}
                    <div className="p-2.5 rounded-xl bg-[#141414] border border-white/10 hover:border-[#d4af37]/40 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5">
                        <ImageIcon size={16} />
                      </div>
                      <span className="text-[10px] font-bold text-white truncate w-full">Vacation Photo</span>
                      <span className="text-[8px] text-slate-500">JPG • 3.8 MB</span>
                    </div>

                    {/* Item 5 */}
                    <div className="p-2.5 rounded-xl bg-[#141414] border border-white/10 hover:border-[#d4af37]/40 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-1.5">
                        <FileText size={16} />
                      </div>
                      <span className="text-[10px] font-bold text-white truncate w-full">Monthly Report</span>
                      <span className="text-[8px] text-slate-500">XLSX • 4.6 MB</span>
                    </div>

                    {/* Item 6 */}
                    <div className="p-2.5 rounded-xl bg-[#141414] border border-white/10 hover:border-[#d4af37]/40 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1.5">
                        <FileText size={16} />
                      </div>
                      <span className="text-[10px] font-bold text-white truncate w-full">Presentation</span>
                      <span className="text-[8px] text-slate-500">PPTX • 8.2 MB</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Floating 3D Graphic Accents Around Hero Mockup */}
            {/* Top Right Floating Cloud Shield Badge */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-6 -right-4 bg-gradient-to-br from-[#d4af37] to-[#b8860b] p-4 rounded-2xl shadow-[0_0_30px_rgba(212,164,55,0.5)] border border-white/30 z-20 flex items-center justify-center"
            >
              <ShieldCheck size={28} className="text-black" />
            </motion.div>

            {/* Top Right Floating Folder Icon Node */}
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute top-12 -right-12 bg-[#161616] p-3.5 rounded-2xl border border-[#d4af37]/40 shadow-xl z-20"
            >
              <Folder size={22} className="text-[#d4af37]" />
            </motion.div>

            {/* Bottom Right Floating User Network Badge */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
              className="absolute -bottom-4 -right-8 bg-[#161616] p-3.5 rounded-2xl border border-[#d4af37]/40 shadow-xl z-20"
            >
              <Users size={22} className="text-[#d4af37]" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── 3. 4-COLUMN FEATURE BAR (BELOW HERO) ────────────────────────────── */}
      <section className="relative z-10 py-8 px-6 max-w-7xl mx-auto border-y border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Col 1 */}
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Secure File Storage</h4>
              <p className="text-xs text-slate-400 mt-1 font-light leading-snug">Your files are encrypted and stored securely in the cloud.</p>
            </div>
          </div>

          {/* Col 2 */}
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] shrink-0">
              <Zap size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Fast File Management</h4>
              <p className="text-xs text-slate-400 mt-1 font-light leading-snug">Upload, organize, rename, preview and manage with ease.</p>
            </div>
          </div>

          {/* Col 3 */}
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] shrink-0">
              <Share2 size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Secure File Sharing</h4>
              <p className="text-xs text-slate-400 mt-1 font-light leading-snug">Share files with control using passwords, expiry &amp; limits.</p>
            </div>
          </div>

          {/* Col 4 */}
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] shrink-0">
              <Globe size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Access Anywhere</h4>
              <p className="text-xs text-slate-400 mt-1 font-light leading-snug">Access your files anytime, anywhere from any device.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4. FEATURES GRID ────────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-extrabold text-[#d4af37] uppercase tracking-widest">FEATURES</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
            Everything You Need to Manage Your Files
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#d4af37]/40 transition-all flex items-start gap-4 group">
            <div className="w-12 h-12 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0 group-hover:bg-[#d4af37] group-hover:text-black transition-all">
              <CloudUpload size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Secure Cloud Storage</h3>
              <p className="text-xs text-slate-400 mt-1.5 font-light leading-relaxed">Store your files safely in the cloud with advanced security.</p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#d4af37]/40 transition-all flex items-start gap-4 group">
            <div className="w-12 h-12 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0 group-hover:bg-[#d4af37] group-hover:text-black transition-all">
              <Folder size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">File Management</h3>
              <p className="text-xs text-slate-400 mt-1.5 font-light leading-relaxed">Upload, preview, rename, download, organize, and delete files easily.</p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#d4af37]/40 transition-all flex items-start gap-4 group">
            <div className="w-12 h-12 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0 group-hover:bg-[#d4af37] group-hover:text-black transition-all">
              <Share2 size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Secure Sharing</h3>
              <p className="text-xs text-slate-400 mt-1.5 font-light leading-relaxed">Generate secure share links with password protection and expiry.</p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#d4af37]/40 transition-all flex items-start gap-4 group">
            <div className="w-12 h-12 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0 group-hover:bg-[#d4af37] group-hover:text-black transition-all">
              <Eye size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">File Preview</h3>
              <p className="text-xs text-slate-400 mt-1.5 font-light leading-relaxed">Preview documents, images, videos and more directly.</p>
            </div>
          </div>

          {/* Card 5 */}
          <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#d4af37]/40 transition-all flex items-start gap-4 group">
            <div className="w-12 h-12 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0 group-hover:bg-[#d4af37] group-hover:text-black transition-all">
              <BarChart3 size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Smart Dashboard</h3>
              <p className="text-xs text-slate-400 mt-1.5 font-light leading-relaxed">Monitor storage usage, activity, and file insights in real-time.</p>
            </div>
          </div>

          {/* Card 6 */}
          <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#d4af37]/40 transition-all flex items-start gap-4 group">
            <div className="w-12 h-12 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shrink-0 group-hover:bg-[#d4af37] group-hover:text-black transition-all">
              <Lock size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Access Control</h3>
              <p className="text-xs text-slate-400 mt-1.5 font-light leading-relaxed">Strong authentication and ownership validation to protect your files.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. SECURITY SECTION ─────────────────────────────────────────────── */}
      <section id="security" className="relative z-10 py-20 px-6 max-w-7xl mx-auto border-t border-white/10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-extrabold text-[#d4af37] uppercase tracking-widest">SECURITY</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
            Security Built Into Every File
          </h2>
          <p className="text-slate-400 mt-3 text-sm font-light">
            VIBNA Storage is designed with authentication, authorization, and controlled sharing to protect your important data.
          </p>
        </div>

        {/* 6 Security Badges Flow Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Badge 1 */}
          <div className="p-4 rounded-xl bg-[#111111] border border-[#d4af37]/20 flex flex-col items-center text-center group hover:border-[#d4af37]/50 transition-all">
            <div className="p-2.5 rounded-full bg-[#d4af37]/15 text-[#d4af37] mb-2.5">
              <UserCheck size={20} />
            </div>
            <span className="text-xs font-bold text-white">Secure Authentication</span>
          </div>

          {/* Badge 2 */}
          <div className="p-4 rounded-xl bg-[#111111] border border-[#d4af37]/20 flex flex-col items-center text-center group hover:border-[#d4af37]/50 transition-all">
            <div className="p-2.5 rounded-full bg-[#d4af37]/15 text-[#d4af37] mb-2.5">
              <ShieldCheck size={20} />
            </div>
            <span className="text-xs font-bold text-white">File Ownership Validation</span>
          </div>

          {/* Badge 3 */}
          <div className="p-4 rounded-xl bg-[#111111] border border-[#d4af37]/20 flex flex-col items-center text-center group hover:border-[#d4af37]/50 transition-all">
            <div className="p-2.5 rounded-full bg-[#d4af37]/15 text-[#d4af37] mb-2.5">
              <Shield size={20} />
            </div>
            <span className="text-xs font-bold text-white">Protected Sharing</span>
          </div>

          {/* Badge 4 */}
          <div className="p-4 rounded-xl bg-[#111111] border border-[#d4af37]/20 flex flex-col items-center text-center group hover:border-[#d4af37]/50 transition-all">
            <div className="p-2.5 rounded-full bg-[#d4af37]/15 text-[#d4af37] mb-2.5">
              <Lock size={20} />
            </div>
            <span className="text-xs font-bold text-white">Access Control</span>
          </div>

          {/* Badge 5 */}
          <div className="p-4 rounded-xl bg-[#111111] border border-[#d4af37]/20 flex flex-col items-center text-center group hover:border-[#d4af37]/50 transition-all">
            <div className="p-2.5 rounded-full bg-[#d4af37]/15 text-[#d4af37] mb-2.5">
              <Clock size={20} />
            </div>
            <span className="text-xs font-bold text-white">Expiring Share Links</span>
          </div>

          {/* Badge 6 */}
          <div className="p-4 rounded-xl bg-[#111111] border border-[#d4af37]/20 flex flex-col items-center text-center group hover:border-[#d4af37]/50 transition-all">
            <div className="p-2.5 rounded-full bg-[#d4af37]/15 text-[#d4af37] mb-2.5">
              <Key size={20} />
            </div>
            <span className="text-xs font-bold text-white">Password Protected Sharing</span>
          </div>
        </div>
      </section>

      {/* ─── 6. HOW IT WORKS SECTION ─────────────────────────────────────────── */}
      <section id="how-it-works" className="relative z-10 py-20 px-6 max-w-7xl mx-auto border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-extrabold text-[#d4af37] uppercase tracking-widest">HOW IT WORKS</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
            Simple Steps to Get Started
          </h2>
        </div>

        {/* 4 Connected Step Nodes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Step 1 */}
          <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 text-center flex flex-col items-center relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#d4af37] text-xs font-black flex items-center justify-center">01</span>
              <div className="w-10 h-10 rounded-xl bg-[#161616] text-[#d4af37] flex items-center justify-center">
                <UserCheck size={20} />
              </div>
            </div>
            <h3 className="text-base font-bold text-white mb-2">Create Your Account</h3>
            <p className="text-xs text-slate-400 font-light">Create an account and securely sign in.</p>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 text-center flex flex-col items-center relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#d4af37] text-xs font-black flex items-center justify-center">02</span>
              <div className="w-10 h-10 rounded-xl bg-[#161616] text-[#d4af37] flex items-center justify-center">
                <CloudUpload size={20} />
              </div>
            </div>
            <h3 className="text-base font-bold text-white mb-2">Upload Your Files</h3>
            <p className="text-xs text-slate-400 font-light">Upload documents, images, videos and any files.</p>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 text-center flex flex-col items-center relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#d4af37] text-xs font-black flex items-center justify-center">03</span>
              <div className="w-10 h-10 rounded-xl bg-[#161616] text-[#d4af37] flex items-center justify-center">
                <Folder size={20} />
              </div>
            </div>
            <h3 className="text-base font-bold text-white mb-2">Manage Your Files</h3>
            <p className="text-xs text-slate-400 font-light">Preview, organize, rename, download and manage.</p>
          </div>

          {/* Step 4 */}
          <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 text-center flex flex-col items-center relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#d4af37] text-xs font-black flex items-center justify-center">04</span>
              <div className="w-10 h-10 rounded-xl bg-[#161616] text-[#d4af37] flex items-center justify-center">
                <Share2 size={20} />
              </div>
            </div>
            <h3 className="text-base font-bold text-white mb-2">Share Securely</h3>
            <p className="text-xs text-slate-400 font-light">Generate controlled share links and share with ease.</p>
          </div>
        </div>
      </section>

      {/* ─── 7. SUPPORTS ALL FILE TYPES (SPLIT DASHBOARD SHOWCASE) ───────────── */}
      <section className="relative z-10 py-20 px-6 max-w-7xl mx-auto border-t border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Description Column */}
          <div className="lg:col-span-4 flex flex-col items-start text-left">
            <span className="text-xs font-extrabold text-[#d4af37] uppercase tracking-widest">SUPPORTS ALL FILE TYPES</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2 leading-tight">
              Store Any File You Need
            </h2>
            <p className="mt-4 text-slate-300 text-sm font-light leading-relaxed">
              VIBNA Storage supports a wide range of file types so you can store everything in one secure place.
            </p>
            <a
              href="#features"
              className="mt-6 px-6 py-2.5 rounded-lg border border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37] hover:text-black font-bold text-xs transition-all inline-block"
            >
              View All Supported Types
            </a>
          </div>

          {/* Right Full Dashboard Interface Graphic */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl bg-[#0D0D0D] border border-white/15 p-5 shadow-[0_0_50px_rgba(0,0,0,0.7)] text-xs">
              {/* Dashboard Top Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-[#161616] border border-[#d4af37]/40 flex items-center justify-center p-0.5">
                    <img src={vibnaLogo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <span className="font-bold text-white text-xs">Dashboard</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input readOnly value="Search" className="bg-[#161616] border border-white/10 rounded-md pl-6 pr-2 py-1 text-[10px] text-slate-400 w-36" />
                  </div>
                  <img className="h-6 w-6 rounded-full ring-1 ring-[#d4af37]" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" alt="Avatar" />
                </div>
              </div>

              {/* 4 Stat Badges */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                <div className="p-3 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Total Files</span>
                    <span className="text-sm font-black text-white">1,248</span>
                    <span className="text-[9px] text-emerald-400 block mt-0.5">+12 this week</span>
                  </div>
                  <CloudUpload size={18} className="text-[#d4af37]" />
                </div>

                <div className="p-3 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Storage Used</span>
                    <span className="text-sm font-black text-white">6.8 GB</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">of 10 GB</span>
                  </div>
                  <HardDrive size={18} className="text-[#d4af37]" />
                </div>

                <div className="p-3 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Shared Files</span>
                    <span className="text-sm font-black text-white">342</span>
                    <span className="text-[9px] text-emerald-400 block mt-0.5">+5 this week</span>
                  </div>
                  <Share2 size={18} className="text-[#d4af37]" />
                </div>

                <div className="p-3 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Recent Activity</span>
                    <span className="text-sm font-black text-white">128</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Today</span>
                  </div>
                  <Zap size={18} className="text-[#d4af37]" />
                </div>
              </div>

              {/* Main Content Grid: Storage Overview + Category Donut + Recent Files */}
              <div className="grid grid-cols-12 gap-4">
                {/* Storage Gauge */}
                <div className="col-span-4 p-4 rounded-xl bg-[#141414] border border-white/5 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-white mb-2 block">Storage Overview</span>
                  <div className="flex items-center justify-center my-2">
                    <div className="w-24 h-24 rounded-full border-4 border-[#d4af37] border-t-transparent flex flex-col items-center justify-center text-center">
                      <span className="text-base font-black text-white">68%</span>
                      <span className="text-[9px] text-slate-400">Used</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>6.8 GB Used</span>
                    <span>3.2 GB Free</span>
                  </div>
                </div>

                {/* Category breakdown */}
                <div className="col-span-4 p-4 rounded-xl bg-[#141414] border border-white/5 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-white mb-2 block">File Categories</span>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-300"><span className="w-2 h-2 rounded-full bg-blue-400" /> Documents</span>
                      <span className="text-slate-400 font-mono">3.4 GB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-300"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Images</span>
                      <span className="text-slate-400 font-mono">1.8 GB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-300"><span className="w-2 h-2 rounded-full bg-[#d4af37]" /> Videos</span>
                      <span className="text-slate-400 font-mono">1.2 GB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-300"><span className="w-2 h-2 rounded-full bg-purple-400" /> Others</span>
                      <span className="text-slate-400 font-mono">0.4 GB</span>
                    </div>
                  </div>
                </div>

                {/* Recent Files Table */}
                <div className="col-span-4 p-4 rounded-xl bg-[#141414] border border-white/5 space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-bold text-white">Recent Files</span>
                    <span className="text-[9px] text-[#d4af37] hover:underline cursor-pointer">View All</span>
                  </div>
                  <div className="space-y-2 text-[10px]">
                    <div className="flex items-center justify-between p-1.5 rounded bg-black/40">
                      <span className="text-slate-200 truncate max-w-[90px]">Project Proposal.pdf</span>
                      <span className="text-slate-500">320 KB</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded bg-black/40">
                      <span className="text-slate-200 truncate max-w-[90px]">Dashboard Design.fig</span>
                      <span className="text-slate-500">420 KB</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded bg-black/40">
                      <span className="text-slate-200 truncate max-w-[90px]">Product Video.mp4</span>
                      <span className="text-slate-500">100 MB</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded bg-black/40">
                      <span className="text-slate-200 truncate max-w-[90px]">Vacation Photo.jpg</span>
                      <span className="text-slate-500">128 KB</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 8. BOTTOM CTA BANNER ────────────────────────────────────────────── */}
      <section className="relative z-10 py-16 px-6 max-w-7xl mx-auto">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#0F0F0F] border border-[#d4af37]/30 shadow-[0_0_50px_rgba(212,164,55,0.15)] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/30 text-[#d4af37] shrink-0">
              <ShieldCheck size={36} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Ready to Take Control of Your Files?</h2>
              <p className="text-slate-400 text-sm mt-1 font-light">Store, manage, and share your files with VIBNA Storage.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/register"
              className="px-7 py-3 rounded-lg bg-[#d4af37] hover:bg-[#e5b548] text-black font-extrabold text-sm shadow-[0_0_25px_rgba(212,164,55,0.35)] transition-all"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="px-7 py-3 rounded-lg border border-white/20 hover:bg-white/10 text-white font-bold text-sm transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 9. FOOTER ───────────────────────────────────────────────────────── */}
      <footer id="about" className="relative z-10 border-t border-white/10 bg-[#030303] pt-16 pb-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10 text-slate-400 text-sm">
          {/* Col 1: Brand */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#111111] border border-[#d4af37]/40 flex items-center justify-center p-1">
                <img src={vibnaLogo} alt="VIBNA Logo" className="w-full h-full object-contain" />
              </div>
              <span className="font-extrabold text-white text-base tracking-wider">VIBNA STORAGE</span>
            </div>
            <p className="text-xs text-slate-400 font-light leading-relaxed max-w-sm">
              Secure cloud storage for your digital files. Engineered with privacy, control, and performance.
            </p>
          </div>

          {/* Col 2: Product Links */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Product</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#features" className="hover:text-[#d4af37] transition-colors">Features</a></li>
              <li><a href="#security" className="hover:text-[#d4af37] transition-colors">Security</a></li>
              <li><a href="#how-it-works" className="hover:text-[#d4af37] transition-colors">How It Works</a></li>
              <li><Link to="/login" className="hover:text-[#d4af37] transition-colors">Pricing</Link></li>
            </ul>
          </div>

          {/* Col 3: Company Links */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#about" className="hover:text-[#d4af37] transition-colors">About Us</a></li>
              <li><span className="hover:text-[#d4af37] transition-colors cursor-pointer">Blog</span></li>
              <li><span className="hover:text-[#d4af37] transition-colors cursor-pointer">Contact</span></li>
              <li><span className="hover:text-[#d4af37] transition-colors cursor-pointer">Careers</span></li>
            </ul>
          </div>

          {/* Col 4: Support Links */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Support</h4>
            <ul className="space-y-2 text-xs">
              <li><span className="hover:text-[#d4af37] transition-colors cursor-pointer">Help Center</span></li>
              <li><span className="hover:text-[#d4af37] transition-colors cursor-pointer">Terms of Service</span></li>
              <li><span className="hover:text-[#d4af37] transition-colors cursor-pointer">Privacy Policy</span></li>
              <li><span className="hover:text-[#d4af37] transition-colors cursor-pointer">FAQ</span></li>
            </ul>
          </div>

        </div>

        {/* Copyright Bar */}
        <div className="max-w-7xl mx-auto mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <span>© {new Date().getFullYear()} VIBNA Storage. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
