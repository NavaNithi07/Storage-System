import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Cloud, HardDrive, FileText, Image as ImageIcon, Video, ArrowUpRight, ShieldCheck, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import vibnaLogo from '../components/vibna.png';
import api from '../services/api';
import { useFileContext } from '../context/FileContext';

const COLORS = ['#966d0c', '#B8860B', '#d8b00c', '#8A6327'];

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalStorage: 1024 * 1024 * 1024 * 5, // 5GB limit mock
    usedStorage: 0,
    totalFiles: 0,
    imagesCount: 0,
    videosCount: 0,
    docsCount: 0,
  });

  const [chartData, setChartData] = useState([]);
  const [recentUploads, setRecentUploads] = useState([]);
  const [favoriteFiles, setFavoriteFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const { refreshKey, socket } = useFileContext();

  const getFileIcon = (category) => {
    switch (category) {
      case 'images':
        return <ImageIcon className="w-4 h-4" />;
      case 'videos':
        return <Video className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/files/dashboard-stats');
      const { stats: backendStats, trend } = res.data;

      setStats(prev => ({
        ...prev,
        usedStorage: backendStats.totalSize || 0,
        totalFiles: backendStats.totalFiles || 0,
        imagesCount: backendStats.imagesCount || 0,
        videosCount: backendStats.videosCount || 0,
        docsCount: backendStats.documentsCount || 0,
      }));
      setChartData(trend || []);

      // Fetch recent files and favorites for Quick Access
      const [recentRes, favsRes] = await Promise.all([
        api.get('/files/history?limit=4'),
        api.get('/files/history?favoritesOnly=true&limit=4'),
      ]);
      setRecentUploads(recentRes.data.items || []);
      setFavoriteFiles(favsRes.data.items || []);
    } catch (err) {
      console.error("Failed to fetch dashboard stats", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [refreshKey, fetchStats]);

  // Subscribe to real-time Socket.IO synchronization
  useEffect(() => {
    if (!socket) return;

    const handleFileDeleted = (deletedId) => {
      console.log('[Dashboard] Real-time fileDeleted event received, filtering ID:', deletedId);
      setRecentUploads(prev => prev.filter(f => (f._id || f.id) !== deletedId));
      setFavoriteFiles(prev => prev.filter(f => (f._id || f.id) !== deletedId));
      // Re-fetch stats in background to update storage counts/sizes
      fetchStats();
    };

    socket.on('fileDeleted', handleFileDeleted);
    return () => {
      socket.off('fileDeleted', handleFileDeleted);
    };
  }, [socket, fetchStats]);

  const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const pieData = [
    { name: 'Images', value: stats.imagesCount },
    { name: 'Videos', value: stats.videosCount },
    { name: 'Documents', value: stats.docsCount },
  ].filter(d => d.value > 0); // Only show categories with actual files

  const storagePercentage = Math.min(100, (stats.usedStorage / stats.totalStorage) * 100).toFixed(1);

  if (loading) {
    return (
      <div className="h-[80vh] w-full flex flex-col items-center justify-center text-slate-400">
        <motion.img
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
          src={vibnaLogo}
          alt="Loading"
          className="w-20 h-20 object-contain mix-blend-screen mb-6 drop-shadow-[0_0_15px_rgba(212,164,55,0.4)]"
        />
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-[#d4af37] animate-spin" />
          <p className="font-semibold tracking-wide text-sm text-[#d4af37]">Aggregating secure analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#D4A437]">Overview</h1>
          <p className="text-slate-400 mt-1">Monitor your storage and activity metrics.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#d4af37]/10 text-[#d4af37] rounded-full border border-[#d4af37]/20 text-sm font-medium">
          <ShieldCheck className="w-4 h-4" />
          System Healthy
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-[#111111]/80 border-[#d4af37]/10 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Total Storage Used</CardTitle>
              <div className="p-2 bg-primary/10 rounded-lg">
                <HardDrive className="w-4 h-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{formatBytes(stats.usedStorage)}</div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-4">
                <div 
                  className="bg-gradient-to-r from-primary to-secondary h-1.5 rounded-full" 
                  style={{ width: `${storagePercentage}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">{storagePercentage}% of {formatBytes(stats.totalStorage)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-[#111111]/80 border-[#d4af37]/10 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Total Files</CardTitle>
              <div className="p-2 bg-secondary/10 rounded-lg">
                <Cloud className="w-4 h-4 text-secondary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalFiles}</div>
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                Real-time MongoDB sync
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-[#111111]/80 border-[#d4af37]/10 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Images</CardTitle>
              <div className="p-2 bg-primary/10 rounded-lg">
                <ImageIcon className="w-4 h-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.imagesCount}</div>
              <p className="text-xs text-slate-500 mt-2">Stored securely</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-[#111111]/80 border-[#d4af37]/10 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Documents</CardTitle>
              <div className="p-2 bg-secondary/10 rounded-lg">
                <FileText className="w-4 h-4 text-secondary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.docsCount}</div>
              <p className="text-xs text-slate-500 mt-2">Active text and PDF files</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts or Empty State */}
      {stats.totalFiles === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-[#111111]/80 border border-[#d4af37]/20 backdrop-blur-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center rounded-[2.5rem] relative overflow-hidden min-h-[420px] shadow-[0_0_30px_rgba(212,164,55,0.05)]">
            {/* Glowing blur effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#d4af37]/10 rounded-full blur-[120px] -z-10 animate-pulse"></div>
            
            <div className="w-24 h-24 rounded-[2rem] bg-black border border-[#d4af37]/20 flex items-center justify-center mb-6 shadow-inner text-slate-400 group-hover:text-[#d4af37] transition-all duration-300 p-4">
              <img src={vibnaLogo} alt="Vibna logo" className="w-full h-full object-contain mix-blend-screen drop-shadow-[0_0_15px_rgba(212,164,55,0.4)] animate-pulse" />
            </div>

            <h2 className="text-3xl font-extrabold text-white mb-3">No activity recorded yet</h2>
            <p className="text-slate-400 text-lg max-w-lg mb-8 leading-relaxed">
              Your analytics dashboard connects directly to your file catalog. Upload your first image, video, or document to see live daily trends and storage breakdowns.
            </p>

            <Link
              to="/my-files"
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-secondary hover:shadow-[0_0_20px_rgba(212,164,55,0.4)] text-black font-bold tracking-wider hover:scale-105 transition-all duration-300 shadow-md"
            >
              Upload Your First File
            </Link>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Area Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="lg:col-span-2">
            <Card className="bg-[#111111]/80 border-[#d4af37]/10 backdrop-blur-xl h-full">
              <CardHeader>
                  <CardTitle className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#d4af37]">Upload Activity</CardTitle>
                <CardDescription>File uploads over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4A437" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#D4A437" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111111', borderColor: '#2A2A2A', borderRadius: '12px' }}
                      itemStyle={{ color: '#F5F5F5' }}
                    />
                    <Area type="monotone" dataKey="uploads" stroke="#D4A437" strokeWidth={3} fillOpacity={1} fill="url(#colorUploads)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pie Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Card className="bg-[#111111]/80 border-[#d4af37]/10 backdrop-blur-xl h-full">
              <CardHeader>
                  <CardTitle className="text-[#D4A437]">Storage Distribution</CardTitle>
                <CardDescription>Files by category</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                {pieData.length === 0 ? (
                  <p className="text-slate-500 text-sm">No categorical files found.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111111', borderColor: '#2A2A2A', borderRadius: '12px' }}
                        itemStyle={{ color: '#F5F5F5' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Quick Access Section */}
      {stats.totalFiles > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {/* Recent Uploads */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <Card className="bg-[#111111]/80 border-[#d4af37]/10 backdrop-blur-xl h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-[#D4A437]">Recently Uploaded</CardTitle>
                  <CardDescription>Your most recent file uploads</CardDescription>
                </div>
                <Link to="/history" className="text-xs text-[#d4af37] hover:underline flex items-center gap-1 font-medium">
                  View All <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentUploads.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4">No recent uploads</p>
                ) : (
                  recentUploads.map(file => {
                    const fid = file._id || file.id;
                    return (
                    <Link
                      key={fid}
                      to={`/viewer/${fid}`}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-[#d4af37]/30 hover:bg-[#d4af37]/5 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-black border border-white/5 text-[#d4af37] shrink-0 group-hover:border-[#d4af37]/30 transition-colors">
                          {getFileIcon(file.category)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate group-hover:text-[#d4af37] transition-colors">{file.filename}</p>
                          <p className="text-xs text-slate-400 font-light mt-0.5">{formatBytes(file.size)}</p>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-[#d4af37] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-2" />
                    </Link>
                  );
                  })
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Starred Favorites */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
            <Card className="bg-[#111111]/80 border-[#d4af37]/10 backdrop-blur-xl h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-[#D4A437]">⭐ Favorites</CardTitle>
                  <CardDescription>Starred files for quick access</CardDescription>
                </div>
                <Link to="/favorites" className="text-xs text-[#d4af37] hover:underline flex items-center gap-1 font-medium">
                  View All <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                {favoriteFiles.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4">No favorite files starred yet</p>
                ) : (
                  favoriteFiles.map(file => {
                    const fid = file._id || file.id;
                    return (
                    <Link
                      key={fid}
                      to={`/viewer/${fid}`}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-[#d4af37]/30 hover:bg-[#d4af37]/5 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-black border border-white/5 text-[#d4af37] shrink-0 group-hover:border-[#d4af37]/30 transition-colors">
                          {getFileIcon(file.category)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate group-hover:text-[#d4af37] transition-colors">{file.filename}</p>
                          <p className="text-xs text-slate-400 font-light mt-0.5">{formatBytes(file.size)}</p>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-[#d4af37] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-2" />
                    </Link>
                  );
                  })
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
