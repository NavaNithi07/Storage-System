import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ArrowDownWideNarrow, Loader, Grid, List, ExternalLink, Trash2, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import HistoryItem from '../components/HistoryItem';
import { useFileContext } from '../context/FileContext';
import { useToast } from '../context/ToastContext';

export default function History({ favoritesOnly = false, trashOnly = false }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('latest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalFiles, setTotalFiles] = useState(0);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'grid';
    return localStorage.getItem('vibna:fileViewMode') || 'grid';
  });

  const navigate = useNavigate();
  const { refreshKey, bumpRefresh, socket } = useFileContext();
  const toast = useToast();

  useEffect(() => {
    if (!socket) return;

    const handleFileDeleted = (deletedId) => {
      console.log('[History] Real-time fileDeleted event received, filtering ID:', deletedId);
      setFiles(prev => prev.filter(f => (f._id || f.id) !== deletedId));
      setTotalFiles(prev => Math.max(0, prev - 1));
    };

    socket.on('fileDeleted', handleFileDeleted);
    return () => {
      socket.off('fileDeleted', handleFileDeleted);
    };
  }, [socket]);

  const categories = [
    { id: 'all', label: 'All Files' },
    { id: 'images', label: 'Images' },
    { id: 'videos', label: 'Videos' },
    { id: 'documents', label: 'Documents' },
  ];

  const sortOptions = [
    { id: 'latest', label: 'Latest First' },
    { id: 'oldest', label: 'Oldest First' },
    { id: 'largest', label: 'Largest Size' },
    { id: 'name', label: 'Name (A-Z)' },
  ];

  const fetchHistory = async (pageNumber = 1, append = false) => {
    try {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams({
        page: pageNumber,
        limit: 12,
        category,
        sort,
      });

      if (search.trim()) params.append('search', search.trim());
      if (favoritesOnly) params.append('favoritesOnly', 'true');
      if (trashOnly) params.append('trashOnly', 'true');

      const res = await api.get(`/files/history?${params.toString()}`);

      if (append) {
        setFiles(prev => [...prev, ...res.data.items]);
      } else {
        setFiles(res.data.items);
      }

      setHasMore(res.data.hasMore);
      setTotalFiles(res.data.total);
      setPage(pageNumber);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchHistory(1, false);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search, category, sort, refreshKey, favoritesOnly]);

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

  const formatDate = (dateString) => {
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const getFileTypeLabel = (file) => {
    const filename = file.filename.toLowerCase();
    if (filename.endsWith('.pdf')) return 'PDF';
    if (filename.endsWith('.docx') || filename.endsWith('.doc')) return 'DOCX';
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) return 'XLSX';
    if (filename.endsWith('.pptx') || filename.endsWith('.ppt')) return 'PPTX';
    if (filename.endsWith('.txt')) return 'TXT';
    if (filename.endsWith('.csv')) return 'CSV';
    if (filename.endsWith('.json')) return 'JSON';
    if (filename.endsWith('.xml')) return 'XML';
    if (filename.endsWith('.md') || filename.endsWith('.markdown')) return 'MD';
    if (file.category === 'images') return 'Image';
    if (file.category === 'videos') return 'Video';
    return file.category?.charAt(0).toUpperCase() + file.category?.slice(1) || 'File';
  };

  const handleRowDelete = async (id) => {
    if (!window.confirm('Move this file to trash?')) return;
    try {
      await api.delete(`/files/${id}`);
      handleDelete(id);
      bumpRefresh();
      toast('File moved to trash', 'success');
    } catch (err) {
      console.error('Failed to delete file', err);
      toast('Failed to delete file', 'error');
    }
  };

  const handleViewFile = (id) => {
    navigate(`/viewer/${id}`);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchHistory(page + 1, true);
    }
  };

  const handleDelete = (id) => {
    setFiles(files.filter(f => (f._id || f.id) !== id));
    setTotalFiles(prev => Math.max(0, prev - 1));
  };

  const handleUpdate = (updatedFile) => {
    const uId = updatedFile._id || updatedFile.id;
    // For favorites page: if file is unfavorited, remove it from the list immediately
    if (favoritesOnly && !updatedFile.isFavorite) {
      setFiles(prev => prev.filter(f => (f._id || f.id) !== uId));
      setTotalFiles(prev => Math.max(0, prev - 1));
    } else {
      setFiles(files.map(f => (f._id || f.id) === uId ? updatedFile : f));
    }
  };

  return (
    <div className="w-full h-full flex flex-col pb-10">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-[#D4A437] mb-2">
          {favoritesOnly ? '⭐ Favorites' : 'File Gallery'}
        </h1>
        <p className="text-slate-400 text-lg">
          {favoritesOnly 
            ? 'Your starred files — quick access to what matters most.'
            : 'Browse, search, and manage all your uploaded media in one beautiful timeline.'}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row gap-4 mb-8 bg-[#111111]/80 p-4 rounded-3xl border border-[#d4af37]/10 backdrop-blur-xl shadow-[0_0_20px_rgba(212,164,55,0.05)]">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by file name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/50 border border-[#d4af37]/20 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/50 transition-all placeholder:text-slate-500 shadow-inner"
          />
        </div>

        <div className="flex flex-col md:flex-row gap-4 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <div className="flex items-center gap-1 bg-black/50 border border-[#d4af37]/20 rounded-2xl p-1.5 shrink-0 shadow-inner">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-5 py-2 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 ${
                  category === cat.id
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative shrink-0 flex items-center bg-black/50 border border-[#d4af37]/20 rounded-2xl px-4 group shadow-inner">
            <ArrowDownWideNarrow size={18} className="text-slate-400 mr-2 group-hover:text-[#d4af37] transition-colors" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-transparent text-slate-200 text-sm font-semibold focus:outline-none appearance-none pr-6 cursor-pointer py-3.5 outline-none"
            >
              {sortOptions.map(opt => (
                <option key={opt.id} value={opt.id} className="bg-slate-900 text-white font-medium">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-20">
            <div className="relative mb-4">
              <Loader size={48} className="animate-spin text-primary relative z-10" />
              <div className="absolute inset-0 bg-primary blur-2xl opacity-40 animate-pulse"></div>
            </div>
            <p className="font-medium tracking-wide">Loading your files...</p>
          </div>
        ) : files.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-900/40 rounded-[2rem] border border-white/5 backdrop-blur-md py-32"
          >
            <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center mb-6 border border-white/5">
               <Filter size={40} className="text-slate-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">No files found</h3>
            <p className="text-slate-400 text-lg">Try adjusting your search or category filters.</p>
          </motion.div>
        ) : (
          <>
            <div className="text-sm font-semibold tracking-wide text-slate-500 mb-6 px-2 flex items-center justify-between">
              <span>Showing <span className="text-white">{files.length}</span> of <span className="text-white">{totalFiles}</span> files</span>
              <div className="flex items-center gap-2 bg-[#111111]/80 rounded-lg p-1 border border-[#d4af37]/10">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-xl transition-colors ${viewMode === 'grid' ? 'bg-[#d4af37]/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  aria-label="Grid view"
                >
                  <Grid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-xl transition-colors ${viewMode === 'list' ? 'bg-[#d4af37]/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  aria-label="List view"
                >
                  <List size={16} />
                </button>
              </div>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <AnimatePresence>
                  {files.map(file => (
                    <HistoryItem 
                      key={file._id || file.id} 
                      file={file} 
                      onDelete={handleDelete}
                      onUpdate={handleUpdate}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-[#d4af37]/20 bg-black/50 shadow-[0_0_20px_rgba(212,164,55,0.05)]">
                <table className="min-w-full text-left text-sm text-[#F5F5F5]">
                  <thead className="bg-[#111111] text-[#d4af37] uppercase text-[11px] tracking-[0.2em] border-b border-[#d4af37]/20">
                    <tr>
                      <th className="px-4 py-4">File Name</th>
                      <th className="px-4 py-4">Type</th>
                      <th className="px-4 py-4">Size</th>
                      <th className="px-4 py-4">Uploaded</th>
                      <th className="px-4 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d4af37]/10">
                    {files.map(file => {
                      const fileId = file._id || file.id;
                      return (
                      <tr key={fileId} className="even:bg-[#1A1A1A]/40 odd:bg-black/40 hover:bg-[#d4af37]/10 transition-colors cursor-default group">
                        <td className="px-4 py-4 text-white font-semibold">{file.filename}</td>
                        <td className="px-4 py-4 text-slate-300">{getFileTypeLabel(file)}</td>
                        <td className="px-4 py-4 text-slate-300">{formatSize(file.size)}</td>
                        <td className="px-4 py-4 text-slate-300">{formatDate(file.createdAt)}</td>
                        <td className="px-4 py-4 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => handleViewFile(fileId)}
                            className="inline-flex items-center justify-center rounded-xl bg-[#d4af37]/10 px-3 py-2 text-xs font-semibold text-[#d4af37] hover:bg-[#d4af37]/20 transition"
                          >
                            <ExternalLink size={14} className="mr-1" /> View
                          </button>
                          <button
                            onClick={() => handleRowDelete(fileId)}
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
              </div>
            )}

            {hasMore && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-8 py-4 rounded-2xl bg-slate-800 text-white hover:bg-slate-700 hover:shadow-lg hover:shadow-primary/20 border border-white/10 font-bold tracking-wider transition-all flex items-center gap-3 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <><Loader size={20} className="animate-spin" /> Loading more...</>
                  ) : (
                    'Load More Files'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
