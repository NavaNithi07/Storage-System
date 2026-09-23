import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  FolderOpen, 
  History, 
  Star, 
  Trash2, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import vibnaLogo from '../Vibna.png';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { type: 'divider' },
  { icon: FolderOpen, label: 'My Files', path: '/my-files' },
  { type: 'divider' },
  { icon: History, label: 'History', path: '/history' },
  { icon: Star, label: 'Favorites', path: '/favorites' },
  { icon: Trash2, label: 'Trash', path: '/trash' },
  { type: 'divider' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Admin Dashboard', path: '/admin/dashboard' },
];

const Sidebar = ({ mobileMenuOpen, setMobileMenuOpen }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { logout, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    if (setMobileMenuOpen) setMobileMenuOpen(false);
    logout();
    navigate('/login');
  };

  const handleNavClick = () => {
    if (setMobileMenuOpen) setMobileMenuOpen(false);
  };

  const currentNavItems = user?.role === 'admin' ? adminNavItems : navItems;

  return (
    <>
      {/* ── Desktop Docked Sidebar (md and up) ── */}
      <motion.aside 
        initial={false}
        animate={{ width: collapsed ? 80 : 260 }}
        className="hidden md:flex h-screen sticky top-0 bg-black/90 backdrop-blur-xl border-r border-[#d4af37]/10 flex-col transition-all duration-300 z-50 shrink-0"
      >
        {/* Header/Logo */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-[#d4af37]/10 relative">
          <div className={cn("flex items-center gap-3 overflow-hidden transition-all duration-200", collapsed && "opacity-0 w-0 hidden")}> 
            <img
              src={vibnaLogo}
              alt="Vibna logo"
              className="w-12 h-12 object-contain mix-blend-screen"
            />
            <span className="text-base font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-[#d4af37] whitespace-nowrap">
              VIBNA
            </span>
          </div>
          {collapsed && (
            <img
              src={vibnaLogo}
              alt="Vibna logo"
              className="w-10 h-10 object-contain mix-blend-screen shrink-0 mx-auto"
            />
          )}

          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-7 w-6 h-6 bg-[#111111] border border-[#d4af37]/20 rounded-full flex items-center justify-center text-[#d4af37] hover:text-[#B8860B] hover:bg-[#d4af37]/10 transition-colors z-50 shadow-md"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          <nav className="space-y-1">
            {currentNavItems.map((item, idx) => {
              if (item.type === 'divider') {
                return <div key={`div-${idx}`} className="h-px bg-[#d4af37]/10 my-4 mx-3" />;
              }
              
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                    isActive 
                      ? "bg-[#d4af37]/10 text-[#d4af37] font-medium border border-[#d4af37]/20" 
                      : "text-slate-400 hover:bg-[#d4af37]/5 hover:text-[#d4af37]"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive ? "text-[#d4af37]" : "group-hover:text-[#d4af37]")} />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {isActive && (
                        <motion.div 
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-[#d4af37] rounded-r-full shadow-[0_0_10px_rgba(212,164,55,0.5)]" 
                        />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer / Logout */}
        <div className="p-4 border-t border-[#d4af37]/10">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-200 w-full group",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* ── Mobile Slide-Over Drawer Overlay (< md screens) ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Dark Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 md:hidden"
            />

            {/* Slide-out Panel */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-[#0d0d0d] border-r border-[#d4af37]/20 flex flex-col z-50 md:hidden shadow-[0_0_50px_rgba(212,164,55,0.2)]"
            >
              {/* Header */}
              <div className="h-20 flex items-center justify-between px-6 border-b border-[#d4af37]/10">
                <div className="flex items-center gap-3">
                  <img
                    src={vibnaLogo}
                    alt="Vibna logo"
                    className="w-10 h-10 object-contain mix-blend-screen"
                  />
                  <span className="text-base font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-[#d4af37]">
                    VIBNA STORAGE
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37]/20 transition-colors"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Navigation Items */}
              <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar">
                <nav className="space-y-2">
                  {currentNavItems.map((item, idx) => {
                    if (item.type === 'divider') {
                      return <div key={`div-mobile-${idx}`} className="h-px bg-[#d4af37]/10 my-4 mx-2" />;
                    }

                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={`mobile-${item.path}`}
                        to={item.path}
                        onClick={handleNavClick}
                        className={({ isActive }) => cn(
                          "flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 text-base font-medium",
                          isActive 
                            ? "bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 shadow-[0_0_15px_rgba(212,164,55,0.1)]" 
                            : "text-slate-300 hover:bg-[#d4af37]/5 hover:text-[#d4af37]"
                        )}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-[#d4af37]" : "text-slate-400")} />
                            <span>{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </nav>
              </div>

              {/* Mobile Logout */}
              <div className="p-4 border-t border-[#d4af37]/10">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-all duration-200 w-full font-medium"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
