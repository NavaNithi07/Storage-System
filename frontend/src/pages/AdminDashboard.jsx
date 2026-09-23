import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  Users, HardDrive, FileText, Activity as ActivityIcon, Loader2, LogOut, Shield, 
  Circle, Ban, CheckCircle, Trash2, Eye, Download, Share2, 
  RefreshCw, TrendingUp, TrendingDown, FileDown, Search, XCircle, UserPlus, FileUp,
  User, ChevronDown, Clock, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import api, { API_BASE_URL } from '../services/api';
import { useToast } from '../context/ToastContext';
import { AuthContext } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import vibnaLogo from '../components/Vibna.png';

const COLORS = ['#D4A437', '#B8860B', '#F3E5AB'];

// Helper to format time ago
const timeAgo = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) !== 1 ? 's' : ''} ago`;
};

// Helper to group activities
const groupActivities = (activities) => {
  const groups = {
    'Today': [],
    'Yesterday': [],
    'Last 7 Days': [],
    'Older': []
  };
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const last7Days = new Date(today);
  last7Days.setDate(last7Days.getDate() - 7);

  activities.forEach(act => {
    const actDate = new Date(act.timestamp);
    if (actDate >= today) groups['Today'].push(act);
    else if (actDate >= yesterday) groups['Yesterday'].push(act);
    else if (actDate >= last7Days) groups['Last 7 Days'].push(act);
    else groups['Older'].push(act);
  });

  return Object.entries(groups).filter(([_, items]) => items.length > 0);
};
// Use dedicated VITE_SOCKET_URL so it works when VITE_API_BASE_URL is a relative path (Vite proxy mode)
const socketUrl = import.meta.env.VITE_SOCKET_URL || 'https://vibna-storage-backend.onrender.com';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user: adminUser, logout } = useContext(AuthContext);
  
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetailStats, setUserDetailStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [trendRange, setTrendRange] = useState('7D');
  const [currentTime, setCurrentTime] = useState(new Date());

  const [securityStats, setSecurityStats] = useState(null);

  const socketRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [overviewRes, usersRes, activitiesRes, securityRes] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/users'),
        api.get('/admin/activities'),
        api.get('/admin/security')
      ]);
      setOverview(overviewRes.data);
      setUsers(usersRes.data);
      setActivities(activitiesRes.data);
      setSecurityStats(securityRes.data);
    } catch (err) {
      console.error('Failed to fetch admin dashboard data:', err);
      toast('Failed to load dashboard statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const token = localStorage.getItem('token');
    socketRef.current = io(socketUrl, {
      auth: token ? { token } : {}
    });

    socketRef.current.on('connect', () => console.log('[Socket] Connected'));
    socketRef.current.on('admin-update', () => fetchData(true));
    socketRef.current.on('activity', (newActivity) => {
      setActivities(prev => [newActivity, ...prev].slice(0, 100));
    });
    socketRef.current.on('stats-update', () => fetchData(true));
    socketRef.current.on('storageUpdated', () => fetchData(true));
    socketRef.current.on('dashboardUpdated', () => fetchData(true));

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast('Logged out securely', 'success');
      navigate('/login');
    } catch (err) {
      toast('Logout failed', 'error');
    }
  };

  const handleSuspend = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/suspend`);
      toast('User suspended', 'success');
      fetchData(true);
      if (selectedUser && selectedUser._id === userId) handleViewUser(userId);
    } catch (err) {
      toast('Failed to suspend user', 'error');
    }
  };

  const handleActivate = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/activate`);
      toast('User activated', 'success');
      fetchData(true);
      if (selectedUser && selectedUser._id === userId) handleViewUser(userId);
    } catch (err) {
      toast('Failed to activate user', 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you absolutely sure you want to delete this user? ALL of their files, custom metadata, and uploads will be deleted permanently from the database and cloud storage. Storage will be freed immediately. This cannot be undone.')) {
      return;
    }
    try {
      await api.delete(`/admin/users/${userId}`);
      toast('User and all associated files permanently deleted', 'success');
      setSelectedUser(null);
      fetchData(true);
    } catch (err) {
      toast('Failed to delete user', 'error');
    }
  };

  const handleViewUser = async (userId) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/users/${userId}/details`);
      setSelectedUser(res.data.user);
      setUserDetailStats(res.data);
    } catch (err) {
      toast('Failed to fetch user details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const getActivityUI = (type) => {
    const base = "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm";
    switch(type) {
      case 'file-uploaded': return { icon: <FileUp size={14} />, className: `${base} bg-blue-500/10 text-blue-400 border-blue-500/20`, label: 'Uploaded' };
      case 'file-deleted': return { icon: <Trash2 size={14} />, className: `${base} bg-rose-500/10 text-rose-400 border-rose-500/20`, label: 'Deleted' };
      case 'file-restored': return { icon: <RefreshCw size={14} />, className: `${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`, label: 'Restored' };
      case 'file-downloaded': return { icon: <Download size={14} />, className: `${base} bg-indigo-500/10 text-indigo-400 border-indigo-500/20`, label: 'Downloaded' };
      case 'user-registered': return { icon: <UserPlus size={14} />, className: `${base} bg-[#D4A437]/10 text-[#D4A437] border-[#d4af37]/20`, label: 'Registered' };
      case 'user-login': return { icon: <ActivityIcon size={14} />, className: `${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`, label: 'Logged In' };
      case 'file-shared': return { icon: <Share2 size={14} />, className: `${base} bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20`, label: 'Shared' };
      case 'user-suspended': return { icon: <Ban size={14} />, className: `${base} bg-rose-500/10 text-rose-400 border-rose-500/20`, label: 'Suspended' };
      case 'user-activated': return { icon: <CheckCircle size={14} />, className: `${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`, label: 'Activated' };
      case 'user-deleted': return { icon: <Trash2 size={14} />, className: `${base} bg-red-600/20 text-red-500 border-red-600/30`, label: 'Deleted User' };
      case 'profile-updated': return { icon: <User size={14} />, className: `${base} bg-purple-500/10 text-purple-400 border-purple-500/20`, label: 'Updated Profile' };
      case 'avatar-updated': return { icon: <User size={14} />, className: `${base} bg-[#D4A437]/10 text-[#D4A437] border-[#d4af37]/20`, label: 'Changed Avatar' };
      default: return { icon: <ActivityIcon size={14} />, className: `${base} bg-[#1A1A1A] text-[#F5F5F5] border-[#111111]`, label: type };
    }
  };

  if (loading || !overview) {
    return (
      <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center text-[#F5F5F5]">
        <motion.img 
          animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          src={vibnaLogo} 
          alt="Vibna" 
          className="w-24 h-24 object-contain mix-blend-screen drop-shadow-[0_0_15px_rgba(212,164,55,0.4)] mb-8" 
        />
        <div className="flex items-center gap-4">
          <Loader2 className="w-5 h-5 text-[#D4A437] animate-spin" />
          <span className="text-[#D4A437] tracking-[0.2em] text-sm font-bold uppercase">Loading Enterprise Console...</span>
        </div>
      </div>
    );
  }

  const { users: userStats, files: fileStats, storage: storageStats, activity: dailyActivity, trends } = overview;
  
  const storagePieData = [
    { name: 'Images', value: storageStats.imagesStorage || 0 },
    { name: 'Videos', value: storageStats.videosStorage || 0 },
    { name: 'Documents', value: storageStats.documentsStorage || 0 }
  ].filter(d => d.value > 0);

  const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase()));
  const groupedActivities = groupActivities(activities);

  // Dynamic Trend Filtering for UI
  const filterTrend = (arr, range) => {
    if (!arr) return [];
    if (range === '7D') return arr.slice(-7);
    if (range === '30D') return arr.slice(-30);
    return arr;
  };

  const uploadTrendData = filterTrend(trends.uploadTrend, trendRange);
  const downloadTrendData = filterTrend(trends.downloadTrend, trendRange);
  
  // Storage Trend: plot exact daily storage snapshot (auto-adjusts on user/file deletion)
  const storageTrendData = filterTrend(trends.storageTrend, trendRange).map(t => ({
    name: t.name,
    size: t.size || 0,
  }));

  return (
    <div className="min-h-screen bg-[#000000] text-[#F5F5F5] font-sans selection:bg-[#D4A437]/30 flex flex-col">
      {/* ── SINGLE HEADER ── */}
      <header className="sticky top-0 z-[100] bg-[#000000]/95 backdrop-blur-2xl border-b border-[#D4A437]/20 shadow-md">
        <div className="w-full px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={vibnaLogo} alt="Vibna logo" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(212,164,55,0.5)]" />
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#F5F5F5] via-[#F3E5AB] to-[#D4A437]">
                VIBNA STORAGE
              </span>
              <span className="text-[10px] tracking-[0.3em] text-[#D4A437] font-semibold uppercase">Enterprise Admin</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-2 bg-[#111111] border border-[#1A1A1A] rounded-full px-4 py-1.5 shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono text-slate-300 ml-1">System Online</span>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-white">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="text-[10px] text-[#D4A437] font-mono tracking-wider">{currentTime.toLocaleDateString()}</div>
            </div>
            
            <div className="h-8 w-[1px] bg-[#1A1A1A] mx-2"></div>
            
            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 hover:bg-[#111111] p-2 rounded-2xl transition-colors border border-transparent hover:border-[#D4A437]/20"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4A437] to-[#B8860B] flex items-center justify-center text-black font-bold shadow-[0_0_15px_rgba(212,164,55,0.4)]">
                  {adminUser?.name?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div className="hidden md:flex flex-col items-start text-left">
                  <span className="text-sm font-bold text-white leading-tight">{adminUser?.name || 'System Admin'}</span>
                  <span className="text-[10px] text-[#D4A437] uppercase tracking-wider font-semibold">Admin Role</span>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 mt-3 w-64 bg-[#111111] border border-[#D4A437]/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-[200]"
                  >
                    <div className="p-4 border-b border-[#1A1A1A] flex items-center gap-4 bg-[#0A0A0A]">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4A437] to-[#B8860B] flex items-center justify-center text-black font-bold text-lg">
                        {adminUser?.name?.charAt(0).toUpperCase() || 'A'}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{adminUser?.name || 'Admin'}</p>
                        <p className="text-xs text-slate-400">{adminUser?.email || 'admin@vibna.com'}</p>
                      </div>
                    </div>
                    <div className="p-2">
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors">
                        <LogOut size={16} /> Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-8 space-y-6 flex-1 bg-[#050505]">
        
        {/* ── TOP ROW: KPIs (5 Columns) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-[#111111] border-[#1A1A1A] hover:border-[#D4A437]/30 transition-all shadow-xl h-full relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                <Users size={48} className="text-[#D4A437]" />
              </div>
              <CardContent className="p-6">
                <p className="text-xs text-[#D4A437] font-bold uppercase tracking-wider mb-2">Total Users</p>
                {userStats.totalUsers === 0 ? (
                  <div className="text-lg font-mono text-slate-500">No users registered yet</div>
                ) : (
                  <div className="text-4xl font-black text-white">{userStats.totalUsers}</div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="bg-[#111111] border-[#1A1A1A] hover:border-[#D4A437]/30 transition-all shadow-xl h-full relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                <CheckCircle size={48} className="text-[#D4A437]" />
              </div>
              <CardContent className="p-6">
                <p className="text-xs text-[#D4A437] font-bold uppercase tracking-wider mb-2">Active Users</p>
                <div className="text-4xl font-black text-white">{userStats.activeUsers}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-[#111111] border-[#1A1A1A] hover:border-[#D4A437]/30 transition-all shadow-xl h-full relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                <FileText size={48} className="text-[#D4A437]" />
              </div>
              <CardContent className="p-6">
                <p className="text-xs text-[#D4A437] font-bold uppercase tracking-wider mb-2">Total Files</p>
                {fileStats.totalFiles === 0 ? (
                  <div className="text-lg font-mono text-slate-500">No files uploaded yet</div>
                ) : (
                  <div className="text-4xl font-black text-white">{fileStats.totalFiles}</div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="bg-[#111111] border-[#1A1A1A] hover:border-[#D4A437]/30 transition-all shadow-xl h-full relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                <HardDrive size={48} className="text-[#D4A437]" />
              </div>
              <CardContent className="p-6">
                <p className="text-xs text-[#D4A437] font-bold uppercase tracking-wider mb-2">Storage Used</p>
                <div className="text-3xl font-black text-white">{formatBytes(storageStats.usedStorage)}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-[#111111] border-[#1A1A1A] hover:border-[#D4A437]/30 transition-all shadow-xl h-full relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                <Circle size={48} className="text-[#D4A437]" />
              </div>
              <CardContent className="p-6">
                <p className="text-xs text-[#D4A437] font-bold uppercase tracking-wider mb-2">Storage Free</p>
                <div className="text-3xl font-black text-white">{formatBytes(storageStats.remainingStorage)}</div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-1.5 w-full bg-[#000000] border border-[#1A1A1A] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#D4A437] to-[#F3E5AB]" style={{ width: `${storageStats.usagePercentage}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{storageStats.usagePercentage}%</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ── MIDDLE ROW: ANALYTICS (4 Columns) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <Card className="bg-[#111111] border-[#1A1A1A] shadow-xl">
            <CardHeader className="border-b border-[#1A1A1A] pb-4">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2"><Circle size={16} className="text-[#D4A437]"/> Storage Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[260px] flex flex-col items-center justify-center relative">
              {storagePieData.length === 0 ? (
                <div className="flex flex-col items-center text-slate-500">
                  <Circle size={40} className="mb-2 opacity-20" />
                  <p className="text-sm font-mono">No storage history available.</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="75%">
                    <PieChart>
                      <Pie data={storagePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                        {storagePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#000000', borderColor: '#d4af37/40', borderRadius: '8px' }}
                        itemStyle={{ color: '#F5F5F5' }}
                        formatter={(value) => formatBytes(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-30px]">
                    <span className="text-[9px] text-[#D4A437] uppercase font-bold tracking-widest">Used</span>
                    <span className="text-lg font-black text-white">{formatBytes(storageStats.usedStorage)}</span>
                  </div>
                  <div className="w-full mt-2 grid grid-cols-3 gap-2">
                    {storagePieData.map((d, i) => (
                      <div key={i} className="text-center bg-[#000000] border border-[#1A1A1A] rounded p-2">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                          <span className="text-[9px] text-slate-400 uppercase">{d.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#111111] border-[#1A1A1A] shadow-xl">
            <CardHeader className="border-b border-[#1A1A1A] pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2"><TrendingUp size={16} className="text-[#D4A437]"/> Storage Trend</CardTitle>
              <div className="flex bg-[#000000] border border-[#1A1A1A] rounded-md overflow-hidden z-10">
                <button className={`px-2 py-1 text-[9px] font-bold ${trendRange === '7D' ? 'bg-[#D4A437]/20 text-[#D4A437]' : 'text-slate-500'} transition-colors`} onClick={() => setTrendRange('7D')}>7D</button>
                <button className={`px-2 py-1 text-[9px] font-bold ${trendRange === '30D' ? 'bg-[#D4A437]/20 text-[#D4A437]' : 'text-slate-500'} transition-colors`} onClick={() => setTrendRange('30D')}>30D</button>
                <button className={`px-2 py-1 text-[9px] font-bold ${trendRange === '90D' ? 'bg-[#D4A437]/20 text-[#D4A437]' : 'text-slate-500'} transition-colors`} onClick={() => setTrendRange('90D')}>90D</button>
              </div>
            </CardHeader>
            <CardContent className="p-6 h-[260px]">
              {storageTrendData.every(t => t.size === 0) ? (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm font-mono">No storage history available.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={storageTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#B8860B" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#B8860B" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                    <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => formatBytes(val, 0)} />
                    <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: '#d4af37/40', borderRadius: '8px' }} formatter={(val) => formatBytes(val)} labelStyle={{ color: '#D4A437' }} />
                    <Area type="monotone" name="Storage Used" dataKey="size" stroke="#B8860B" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" animationDuration={500} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#111111] border-[#1A1A1A] shadow-xl">
            <CardHeader className="border-b border-[#1A1A1A] pb-4">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2"><BarChart2 size={16} className="text-[#D4A437]"/> Upload Analytics</CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[260px]">
              {uploadTrendData.every(t => t.count === 0) ? (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm font-mono">No upload data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={uploadTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                    <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: '#d4af37/40', borderRadius: '8px' }} cursor={{ fill: '#ffffff0a' }} labelStyle={{ color: '#D4A437' }} />
                    <Bar name="Files Uploaded" dataKey="count" fill="#D4A437" radius={[4, 4, 0, 0]} animationDuration={500} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#111111] border-[#1A1A1A] shadow-xl">
            <CardHeader className="border-b border-[#1A1A1A] pb-4">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2"><TrendingDown size={16} className="text-[#F3E5AB]"/> Download Analytics</CardTitle>
            </CardHeader>
            <CardContent className="p-6 h-[260px]">
              {downloadTrendData.every(t => t.count === 0) ? (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm font-mono">No download data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={downloadTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                    <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: '#F3E5AB/40', borderRadius: '8px' }} labelStyle={{ color: '#F3E5AB' }} />
                    <Line type="monotone" name="Downloads" dataKey="count" stroke="#F3E5AB" strokeWidth={3} dot={{ r: 3, fill: '#F3E5AB', strokeWidth: 0 }} activeDot={{ r: 5 }} animationDuration={500} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── SECURITY ROW (4 Columns) ── */}
        {securityStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <Card className="bg-[#111111] border-[#1A1A1A] shadow-xl">
              <CardHeader className="border-b border-[#1A1A1A] pb-4">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2"><Shield size={16} className="text-[#D4A437]"/> Access Security</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-mono">Active Sessions</span>
                  <span className="text-xl font-black text-emerald-400">{securityStats.activeSessions}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-mono">Failed Logins</span>
                  <span className="text-xl font-black text-rose-400">{securityStats.failedLogins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-mono">Locked Accounts</span>
                  <span className="text-xl font-black text-red-500">{securityStats.lockedAccounts}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#111111] border-[#1A1A1A] shadow-xl">
              <CardHeader className="border-b border-[#1A1A1A] pb-4">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2"><Share2 size={16} className="text-[#F3E5AB]"/> Link Security</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-mono">Active Share Links</span>
                  <span className="text-xl font-black text-[#D4A437]">{securityStats.activeShareLinks}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#111111] border-[#1A1A1A] shadow-xl xl:col-span-2">
              <CardHeader className="border-b border-[#1A1A1A] pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2"><ActivityIcon size={16} className="text-rose-400"/> Recent Security Alerts</CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[150px] overflow-y-auto custom-scrollbar">
                {securityStats.recentAlerts.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm font-mono">No recent security alerts.</div>
                ) : (
                  <div className="p-4 space-y-2">
                    {securityStats.recentAlerts.map(alert => (
                      <div key={alert._id} className="flex justify-between items-center bg-[#000000] border border-rose-500/20 p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                          <XCircle size={16} className="text-rose-500" />
                          <div>
                            <p className="text-sm text-white font-bold">{alert.userName} <span className="text-rose-400 font-mono text-[10px]">[{alert.ipAddress}]</span></p>
                            <p className="text-[10px] text-slate-400 font-mono">{alert.type === 'user-login-failed' ? 'Failed Login Attempt' : 'Account Locked'}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500">{timeAgo(alert.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── BOTTOM ROW: OPERATIONS (4 Columns) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Live Activity Feed */}
          <Card className="bg-[#111111] border-[#1A1A1A] shadow-xl flex flex-col h-[550px] lg:col-span-4">
            <CardHeader className="border-b border-[#1A1A1A] pb-4 sticky top-0 bg-[#111111] z-10">
              <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-2"><ActivityIcon size={16} className="text-[#D4A437]"/> Live Activity Feed</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden flex-1 flex flex-col">
              {activities.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm font-mono m-auto">No activity recorded yet.</div>
              ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                  <AnimatePresence initial={false}>
                    {groupedActivities.map(([groupName, items]) => (
                      <div key={groupName} className="space-y-3">
                        <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold sticky top-0 bg-[#111111]/90 py-1 backdrop-blur z-10">{groupName}</h4>
                        {items.map((act) => {
                          const ui = getActivityUI(act.type);
                          return (
                            <motion.div 
                              key={act._id} 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3 }}
                              className="flex items-center gap-4 bg-[#000000] border border-[#1A1A1A] p-4 rounded-xl hover:border-[#D4A437]/30 transition-colors shadow-sm w-full"
                            >
                              <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#1A1A1A] to-[#0A0A0A] border border-[#D4A437]/20 text-xs font-bold text-[#D4A437] shadow-inner">
                                {act.userName?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                                <span className="text-sm font-bold text-white shrink-0 truncate max-w-[120px]">{act.userName}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {ui.icon}
                                  <span className="text-xs font-medium text-slate-400">{ui.label}</span>
                                </div>
                                {act.fileName ? (
                                  <span className="text-[11px] text-slate-300 truncate bg-[#111111] border border-[#1A1A1A] px-2 py-0.5 rounded-md flex-1 min-w-0">
                                    {act.fileName}
                                  </span>
                                ) : (
                                  <span className="flex-1"></span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono shrink-0 whitespace-nowrap hidden sm:flex items-center gap-1">
                                <Clock size={10}/> {timeAgo(act.timestamp)}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Events */}
          <Card className="bg-[#111111] border-[#1A1A1A] shadow-xl flex flex-col h-[550px] lg:col-span-2">
            <CardHeader className="border-b border-[#1A1A1A] pb-4">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2"><Clock size={16} className="text-[#D4A437]"/> Daily Events</CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
              <div className="bg-[#000000] border border-[#1A1A1A] p-4 rounded-xl flex justify-between items-center group hover:border-[#D4A437]/20 transition-all">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider group-hover:text-[#D4A437] transition-colors">Uploads</span>
                <span className="text-xl font-black text-white">{dailyActivity.uploadsToday}</span>
              </div>
              <div className="bg-[#000000] border border-[#1A1A1A] p-4 rounded-xl flex justify-between items-center group hover:border-[#D4A437]/20 transition-all">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider group-hover:text-[#D4A437] transition-colors">Downloads</span>
                <span className="text-xl font-black text-white">{dailyActivity.downloadsToday}</span>
              </div>
              <div className="bg-[#000000] border border-[#1A1A1A] p-4 rounded-xl flex justify-between items-center group hover:border-[#D4A437]/20 transition-all">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider group-hover:text-[#D4A437] transition-colors">Shares</span>
                <span className="text-xl font-black text-white">{dailyActivity.sharesToday || 0}</span>
              </div>
              <div className="bg-[#000000] border border-[#1A1A1A] p-4 rounded-xl flex justify-between items-center group hover:border-[#D4A437]/20 transition-all">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider group-hover:text-[#D4A437] transition-colors">Restores</span>
                <span className="text-xl font-black text-white">{dailyActivity.restoredFilesToday || 0}</span>
              </div>
              <div className="bg-[#000000] border border-[#1A1A1A] p-4 rounded-xl flex justify-between items-center group hover:border-[#D4A437]/20 transition-all">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider group-hover:text-[#D4A437] transition-colors">Deletes</span>
                <span className="text-xl font-black text-white">{dailyActivity.deletedFilesToday || 0}</span>
              </div>
              <div className="bg-[#000000] border border-[#1A1A1A] p-4 rounded-xl flex justify-between items-center group hover:border-[#D4A437]/20 transition-all">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider group-hover:text-[#D4A437] transition-colors">New Users</span>
                <span className="text-xl font-black text-white">{userStats.newRegistrationsToday || 0}</span>
              </div>
              <div className="bg-[#000000] border border-[#1A1A1A] p-4 rounded-xl flex justify-between items-center group hover:border-[#D4A437]/20 transition-all">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider group-hover:text-[#D4A437] transition-colors">Logins</span>
                <span className="text-xl font-black text-white">{dailyActivity.loginsToday || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* User Statistics (Table) */}
          <Card className="bg-[#111111] border-[#1A1A1A] shadow-xl lg:col-span-4 flex flex-col h-[550px]">
            <CardHeader className="border-b border-[#1A1A1A] pb-4">
              <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-2"><Users size={16} className="text-[#D4A437]"/> Recent Users</span>
              </CardTitle>
              <div className="mt-3 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input 
                  placeholder="Search accounts..." 
                  className="w-full pl-9 bg-[#000000] border-[#1A1A1A] text-sm focus:border-[#D4A437]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1 custom-scrollbar">
              <div className="divide-y divide-[#1A1A1A]">
                {filteredUsers.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm font-mono">No users found.</div>
                ) : (
                  filteredUsers.map((u) => (
                    <div key={u._id} className="p-4 hover:bg-[#000000]/50 transition-colors flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#000000] border border-[#D4A437]/30 flex items-center justify-center font-bold text-xs text-[#D4A437]">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{u.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="font-mono text-[#D4A437]">{formatBytes(u.totalStorageUsed || 0)}</span>
                            <span>•</span>
                            <span>{u.totalFiles || 0} files</span>
                          </div>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-[#D4A437]/10 hover:text-[#D4A437]" onClick={() => handleViewUser(u._id)}>
                        <Eye size={14} />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Platform Health */}
          <Card className="bg-[#111111] border-[#1A1A1A] shadow-xl flex flex-col h-[550px] lg:col-span-2">
            <CardHeader className="border-b border-[#1A1A1A] pb-4">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2"><Shield size={16} className="text-[#D4A437]"/> Platform Health</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
              
              <div className="space-y-4">
                <div className="flex flex-col gap-1 text-center bg-[#000000] p-4 rounded-xl border border-[#1A1A1A]">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">System Status</span>
                  <span className="text-emerald-400 font-black tracking-widest flex items-center justify-center gap-2"><CheckCircle size={14}/> ONLINE</span>
                </div>
                
                <div className="flex flex-col gap-1 text-center bg-[#000000] p-4 rounded-xl border border-[#1A1A1A]">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Active Connections</span>
                  <span className="text-white font-black tracking-widest">{userStats.onlineUsers || 1}</span>
                </div>

                <div className="flex flex-col gap-1 text-center bg-[#000000] p-4 rounded-xl border border-[#1A1A1A]">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Shared Links</span>
                  <span className="text-[#F3E5AB] font-black tracking-widest">{fileStats.sharedFilesCount || 0}</span>
                </div>

                <div className="flex flex-col gap-1 text-center bg-[#000000] p-4 rounded-xl border border-[#1A1A1A]">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Trash Size</span>
                  <span className="text-rose-400 font-black tracking-widest">{fileStats.trashFilesCount || 0} files</span>
                </div>
              </div>

              <div className="mt-auto">
                <Button onClick={() => fetchData()} variant="outline" className="w-full justify-center bg-[#000000] border-[#1A1A1A] hover:border-[#D4A437]/50 hover:bg-[#D4A437]/10 hover:text-[#D4A437] transition-all">
                  <RefreshCw size={14} className="mr-2" /> Force Sync
                </Button>
              </div>

            </CardContent>
          </Card>

        </div>

        {/* ── USER DETAILS MODAL ── */}
        <AnimatePresence>
          {selectedUser && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) setSelectedUser(null); }}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-[#111111] border border-[#1A1A1A] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              >
                <div className="p-6 border-b border-[#1A1A1A] flex justify-between items-start bg-[#0A0A0A]">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#000000] border-2 border-[#D4A437] flex items-center justify-center text-[#D4A437] font-black text-2xl shadow-[0_0_20px_rgba(212,164,55,0.2)]">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedUser.name}</h2>
                      <p className="text-slate-400 text-sm">{selectedUser.email}</p>
                      <div className="mt-2 flex gap-2">
                        {selectedUser.isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 uppercase border border-rose-500/20">
                            <Ban size={10} /> Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase border border-emerald-500/20">
                            <CheckCircle size={10} /> Active
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#000000] text-slate-400 uppercase border border-[#1A1A1A]">
                          Joined {new Date(selectedUser.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)} className="text-slate-500 hover:text-white hover:bg-[#1A1A1A]">
                    <XCircle size={24} />
                  </Button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                  {detailLoading || !userDetailStats ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-[#D4A437] animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-[#000000] border border-[#1A1A1A] rounded-xl p-5">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <HardDrive size={14} /> Storage Profile
                        </h3>
                        <div>
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-slate-400">Usage limit: {formatBytes(userDetailStats.storage.totalCapacity)}</span>
                            <span className="text-white font-mono">{formatBytes(userDetailStats.storage.storageUsed)}</span>
                          </div>
                          <div className="h-2 w-full bg-[#111111] rounded-full overflow-hidden border border-[#1A1A1A]">
                            <div className="h-full bg-gradient-to-r from-[#D4A437] to-[#F3E5AB]" style={{ width: `${Math.min(100, userDetailStats.storage.usagePercentage)}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#000000] border border-[#1A1A1A] rounded-xl p-5">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Shield size={14} /> Security & Operations
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedUser.isSuspended ? (
                            <Button onClick={() => handleActivate(selectedUser._id)} className="w-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 shadow-none">
                              <CheckCircle size={14} className="mr-2" /> Reactivate Account
                            </Button>
                          ) : (
                            <Button onClick={() => handleSuspend(selectedUser._id)} className="w-full bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 shadow-none">
                              <Ban size={14} className="mr-2" /> Suspend Account
                            </Button>
                          )}
                          
                          <Button onClick={() => handleDeleteUser(selectedUser._id)} className="w-full bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-600/30 shadow-none">
                            <Trash2 size={14} className="mr-2" /> Delete Account & Files
                          </Button>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-4 text-center">
                          Warning: Deleting an account will permanently erase all database records and cloud assets instantly.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
