import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Video, FileText, Folder, Loader2, Grid, List, ExternalLink, Trash2 } from 'lucide-react';
import UploadContainer from '../components/UploadContainer';
import HistoryItem from '../components/HistoryItem';
import api from '../services/api';
import { useFileContext } from '../context/FileContext';

const tabs = [
  { 
    id: 'images', 
    label: 'Images', 
    icon: ImageIcon, 
    accept: 'image/*', 
    supportedText: 'JPG, PNG, WEBP, SVG',
    gradient: 'from-[#D4A437]/20 to-[#B8860B]/10',
    color: 'text-[#D4A437]',
    borderColor: 'border-[#D4A437]/30'
  },
  { 
    id: 'videos', 
    label: 'Videos', 
    icon: Video, 
    accept: '.mp4,.mov,.webm,.avi,.mkv,video/*', 
    supportedText: 'MP4, MOV, WEBM, AVI, MKV',
    gradient: 'from-[#F3E5AB]/20 to-[#D4A437]/10',
    color: 'text-[#F3E5AB]',
    borderColor: 'border-[#F3E5AB]/30'
  },
  { 
    id: 'documents', 
    label: 'Documents', 
    icon: FileText, 
    accept: 'application/*,text/*', 
    supportedText: 'PDF, DOCX, XLSX, TXT',
    gradient: 'from-[#B8860B]/20 to-[#8A6327]/10',
    color: 'text-[#B8860B]',
    borderColor: 'border-[#B8860B]/30'
  },
];

export default function MyFiles() {
  const [activeTab, setActiveTab] = useState('images');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'grid';
    return localStorage.getItem('vibna:fileViewMode') || 'grid';
  });

  const navigate = useNavigate();
  const { refreshKey, socket, bumpRefresh } = useFileContext();

  const fetchCategoryFiles = useCallback(async (category) => {
    try {
      setLoading(true);
      const res = await api.get(`/files/history?category=${category}&limit=12`);
      setFiles(res.data.items || []);
    } catch (err) {
      console.error(`Failed to fetch ${category} files`, err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchCategoryFiles(activeTab);
    });
  }, [activeTab, fetchCategoryFiles, refreshKey]);

  // Subscribe to real-time delete synchronization
  useEffect(() => {
    if (!socket) return;
    
    const handleFileDeleted = (deletedId) => {
      console.log('[MyFiles] Real-time fileDeleted event received, filtering ID:', deletedId);
      setFiles(prev => prev.filter(f => (f._id || f.id) !== deletedId));
    };

    socket.on('fileDeleted', handleFileDeleted);
    return () => {
      socket.off('fileDeleted', handleFileDeleted);
    };
  }, [socket]);

  const handleUploadSuccess = () => {
    // Refresh files immediately on upload success
    fetchCategoryFiles(activeTab);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this file to Trash?')) return;
    try {
      await api.delete(`/files/${id}`);
      setFiles(prev => prev.filter(f => (f._id || f.id) !== id));
      bumpRefresh();
    } catch (err) {
      console.error('Failed to delete file', err);
    }
  };

  const handleUpdate = (updatedFile) => {
    setFiles(prev => prev.map(f => (f._id || f.id) === (updatedFile._id || updatedFile.id) ? updatedFile : f));
  };

  useEffect(() => {
    window.localStorage.setItem('vibna:fileViewMode', viewMode);
  }, [viewMode]);

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const currentTab = tabs.find(t => t.id === activeTab);
  const TabIcon = currentTab.icon;

  return (
    <div className="w-full h-full flex flex-col pb-10">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-[#d4af37]/20 text-[#d4af37] rounded-xl border border-[#d4af37]/30 shadow-[0_0_15px_rgba(212,164,55,0.2)]">
            <Folder className="w-6 h-6" />
          </div>
          <h1 className="text-4xl font-extrabold text-[#D4A437]">
            My Workspace
          </h1>
        </div>
        <p className="text-slate-400 text-base max-w-2xl ml-1">
          Upload and manage your images, videos, and documents inside your dedicated, encrypted cloud workspace.
        </p>
      </div>

      {/* Modern Sliding Tabs */}
      <div className="flex justify-start mb-8 bg-[#111111]/80 p-1.5 rounded-2xl border border-[#d4af37]/10 backdrop-blur-xl w-fit self-start shadow-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 relative ${
                isActive 
                  ? 'text-white' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-category-tab"
                  className="absolute inset-0 bg-primary/20 border border-primary/30 rounded-xl shadow-lg"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon size={18} className={isActive ? 'text-primary' : 'text-slate-500'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Categories Workspace Grid */}
      <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
        {/* Left Side: Category-specific Upload Card */}
        <div className="w-full lg:w-[360px] shrink-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <UploadContainer
                key={activeTab}
                title={currentTab.label}
                category={currentTab.id}
                icon={TabIcon}
                supportedText={currentTab.supportedText}
                accept={currentTab.accept}
                onUploadSuccess={handleUploadSuccess}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Side: Category-specific Files Grid */}
        <div className="flex-grow w-full">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Uploaded {currentTab.label}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#111111] border border-[#d4af37]/20 text-[#d4af37] font-bold">
                {files.length} Total
              </span>
            </h3>
            <div className="flex items-center gap-2 bg-[#111111] rounded-2xl p-1 border border-[#d4af37]/10">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-xl transition ${viewMode === 'grid' ? 'bg-primary/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                aria-label="Grid view"
              >
                <Grid size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-xl transition ${viewMode === 'list' ? 'bg-primary/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                aria-label="List view"
              >
                <List size={16} />
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading-category-files"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 text-slate-400"
              >
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                <p className="text-sm font-semibold tracking-wide">Syncing category gallery...</p>
              </motion.div>
            ) : files.length === 0 ? (
              <motion.div
                key="empty-category-files"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`w-full py-20 flex flex-col items-center justify-center bg-slate-900/20 border border-dashed border-white/5 rounded-[2rem] text-center`}
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-900/60 border border-white/5 flex items-center justify-center mb-4 text-slate-500">
                  <TabIcon size={28} />
                </div>
                <h4 className="text-white font-bold text-xl mb-1">No {currentTab.label.toLowerCase()} found</h4>
                <p className="text-slate-400 text-sm max-w-sm">
                  Drag and drop files on the left to start collecting your encrypted media.
                </p>
              </motion.div>
            ) : viewMode === 'grid' ? (
              <motion.div
                key="category-files-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                <AnimatePresence>
                  {files.map((file) => (
                    <HistoryItem
                      key={file._id}
                      file={file}
                      onDelete={handleDelete}
                      onUpdate={handleUpdate}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="category-files-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-x-auto rounded-3xl border border-[#d4af37]/20 bg-black/50 shadow-[0_0_20px_rgba(212,164,55,0.05)]"
              >
                <table className="min-w-full text-left text-sm text-[#F5F5F5]">
                  <thead className="bg-[#111111] text-[#d4af37] uppercase text-[11px] tracking-[0.2em] border-b border-[#d4af37]/20">
                    <tr>
                      <th className="px-4 py-4">File Name</th>
                      <th className="px-4 py-4">Size</th>
                      <th className="px-4 py-4">Uploaded</th>
                      <th className="px-4 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d4af37]/10">
                    {files.map((file) => {
                      const fileId = file._id || file.id;
                      return (
                      <tr key={fileId} className="even:bg-[#1A1A1A]/40 odd:bg-black/40 hover:bg-[#d4af37]/10 transition-colors cursor-default group">
                        <td className="px-4 py-4 text-white font-semibold">{file.filename}</td>
                        <td className="px-4 py-4 text-slate-300">{formatSize(file.size)}</td>
                        <td className="px-4 py-4 text-slate-300">{new Date(file.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-4 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/viewer/${fileId}`)}
                            className="inline-flex items-center justify-center rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                          >
                            <ExternalLink size={14} className="mr-1" /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(fileId)}
                            className="inline-flex items-center justify-center rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                          >
                            <Trash2 size={14} className="mr-1" /> Delete
                          </button>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
