import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  FolderOpen, 
  History, 
  Star, 
  Trash2, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import vibnaLogo from '../vibna.png';

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

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { logout, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.aside 
      initial={false}
      animate={{ width: collapsed ? 80 : 260 }}
      className="h-screen sticky top-0 bg-black/90 backdrop-blur-xl border-r border-[#d4af37]/10 flex flex-col transition-all duration-300 z-50"
    >
      {/* Header/Logo */}
        <div className="h-24 flex items-center justify-between px-6 border-b border-[#d4af37]/10">
        <div className={cn("flex items-center gap-3 overflow-hidden", collapsed && "opacity-0 w-0 hidden")}> 
          <img
            src={vibnaLogo}
            alt="Vibna logo"
            className="w-16 h-16 object-contain mix-blend-screen"
          />
        </div>
        {collapsed && (
          <img
            src={vibnaLogo}
            alt="Vibna logo"
            className="w-12 h-12 object-contain mix-blend-screen shrink-0 mx-auto"
          />
        )}

        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-[#111111] border border-[#d4af37]/20 rounded-full flex items-center justify-center text-[#d4af37] hover:text-[#B8860B] hover:bg-[#d4af37]/10 transition-colors z-50 shadow-md"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
        <nav className="space-y-1">
          {(user?.role === 'admin' ? adminNavItems : navItems).map((item, idx) => {
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
  );
};

export default Sidebar;
