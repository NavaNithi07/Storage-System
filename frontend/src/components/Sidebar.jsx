import { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LayoutDashboard, History, LogOut, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Sidebar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'My Files', path: '/my-files', icon: <LayoutDashboard size={20} /> },
    { name: 'History', path: '/history', icon: <History size={20} /> },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen bg-slate-900/50 backdrop-blur-xl border-r border-white/10 p-6 sticky top-0">
        <div className="flex items-center gap-3 mb-10">
          <img
            src="./Vibna.png"
            alt="Vibna"
            className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-[#d4af37]/20"
          />
          <span className="text-xl font-extrabold text-white tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-white to-[#d4af37]">
            VIBNA
          </span>
        </div>

        <div className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]">
              <UserIcon size={20} />
            </div>
<div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
        </div>
        </div>

        <nav className="flex-1 flex flex-col gap-2">
          {navLinks.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative group overflow-hidden ${
                  isActive
                    ? 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 shadow-lg shadow-[#d4af37]/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="active-nav"
                      className="absolute left-0 top-0 w-1 h-full bg-[#d4af37]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                  <span className="relative z-10">{link.icon}</span>
                  <span className="relative z-10 font-medium">{link.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/80 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-4 z-50">
        {navLinks.map((link) => (
          <NavLink
            key={link.name}
            to={link.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                isActive ? 'text-[#d4af37]' : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            {link.icon}
            <span className="text-[10px] font-medium">{link.name}</span>
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center w-full h-full gap-1 text-slate-500 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </nav>
    </>
  );
}
