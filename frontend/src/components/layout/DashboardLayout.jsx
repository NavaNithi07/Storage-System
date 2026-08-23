import { useContext, useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, LogOut, User, ChevronDown, Circle } from 'lucide-react';
import Sidebar from './Sidebar';
import vibnaLogo from '../vibna.png';
import { AuthContext } from '../../context/AuthContext';

const DashboardLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click and handle inactivity logout (15 mins)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Inactivity logout timer setup (15 mins)
    const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 mins
    let timeoutId;

    const handleUserActivity = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.warn('[Inactivity Tracker] Session inactive for 15 mins. Logging out.');
        logout();
        navigate('/login');
      }, INACTIVITY_LIMIT);
    };

    // Initialize timer
    handleUserActivity();

    // Listen for user interaction events
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(event => document.addEventListener(event, handleUserActivity));

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, handleUserActivity));
    };
  }, [logout, navigate]);

  const handleNavigate = (path) => {
    setDropdownOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const AvatarSmall = () =>
    user?.avatar ? (
      <img
        src={user.avatar}
        alt={user?.name || 'User'}
        className="w-10 h-10 rounded-full object-cover border-2 border-[#d4af37]/30"
      />
    ) : (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4A437] to-[#B8860B] flex items-center justify-center text-black font-bold text-base select-none border-2 border-[#d4af37]/30">
        {user?.name ? user.name.charAt(0).toUpperCase() : <User size={18} />}
      </div>
    );

  const AvatarLarge = () =>
    user?.avatar ? (
      <img
        src={user.avatar}
        alt={user?.name || 'User'}
        className="w-12 h-12 rounded-full object-cover border-2 border-[#d4af37]/40"
      />
    ) : (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4A437] to-[#B8860B] flex items-center justify-center text-black font-bold text-lg select-none border-2 border-[#d4af37]/40">
        {user?.name ? user.name.charAt(0).toUpperCase() : <User size={22} />}
      </div>
    );

  return (
    <div className="flex min-h-screen bg-black text-[#F5F5F5] selection:bg-[#d4af37]/30 selection:text-white">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden flex flex-col">
        {/* ── Header ── */}
        <header className="shrink-0 border-b border-[#d4af37]/10 bg-[#111111]/80 backdrop-blur-xl flex items-center justify-between px-6 py-4 z-40 sticky top-0">
          {/* Left – Logo */}
          <div className="flex items-center gap-4">
            <img
              src={vibnaLogo}
              alt="Vibna logo"
              className="w-10 h-10 object-contain mix-blend-screen drop-shadow-[0_0_10px_rgba(212,164,55,0.3)]"
            />
            <span className="text-xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#d4af37]">
              VIBNA STORAGE
            </span>
          </div>

          {/* Right – Profile Panel */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-[#d4af37]/10 transition-colors duration-200 focus:outline-none"
            >
              {/* Avatar with online dot */}
              <div className="relative">
                <AvatarSmall />
                {/* Green online dot */}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#111111]" />
              </div>

              {/* Username & Bio displayed on top right corner */}
              <div className="flex flex-col text-left max-w-[140px] md:max-w-[180px] min-w-[70px]">
                <span className="text-sm font-bold text-white truncate leading-tight" title={user?.username || user?.name || 'User'}>
                  {user?.username || user?.name || 'User'}
                </span>
                <span className="text-[11px] text-[#d4af37] truncate leading-tight font-medium mt-0.5" title={user?.bio || 'No bio set'}>
                  {user?.bio || 'No bio set'}
                </span>
              </div>

              {/* Chevron */}
              <ChevronDown
                size={16}
                className={`text-[#d4af37] transition-transform duration-200 shrink-0 ${
                  dropdownOpen ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>

            {/* ── Dropdown ── */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute top-full right-0 mt-2 w-64 bg-[#111111] border border-[#d4af37]/20 rounded-2xl backdrop-blur-xl shadow-[0_0_30px_rgba(212,164,55,0.15)] overflow-hidden z-50"
                >
                  {/* User info section */}
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className="relative shrink-0">
                      <AvatarLarge />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#111111]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate" title={user?.username || user?.name}>
                        {user?.username || user?.name || 'User'}
                      </p>
                      <p className="text-xs text-[#d4af37] truncate mt-0.5 font-medium" title={user?.bio}>
                        {user?.bio || 'No bio set'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                        {user?.email || ''}
                      </p>
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                        <Circle size={5} fill="currentColor" className="shrink-0" />
                        Online
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-[#d4af37]/10 my-1" />

                  {/* Menu items */}
                  <div className="px-2 py-2 flex flex-col gap-1">
                    <button
                      onClick={() => handleNavigate('/settings')}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-[#d4af37]/10 transition-colors duration-150 text-left group"
                    >
                      <Settings
                        size={16}
                        className="text-[#d4af37] group-hover:rotate-45 transition-transform duration-300 shrink-0"
                      />
                      <span className="text-sm font-medium text-[#F5F5F5]">
                        Profile &amp; Settings
                      </span>
                    </button>

                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-rose-500/10 transition-colors duration-150 text-left group"
                    >
                      <LogOut
                        size={16}
                        className="text-rose-400 shrink-0"
                      />
                      <span className="text-sm font-medium text-rose-400">
                        Logout
                      </span>
                    </button>
                  </div>

                  {/* Bottom padding */}
                  <div className="pb-2" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* ── Page content ── */}
        <div className="h-full w-full max-w-7xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
