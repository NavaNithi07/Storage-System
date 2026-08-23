import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, File as FileIcon, Trash2, Edit2, Copy, Download } from 'lucide-react';

import api from '../services/api';
import { Card } from './ui/Card';
import { useToast } from '../context/ToastContext';
import { useFileContext } from '../context/FileContext';
import { copyLinkToClipboard, getFrontendBaseUrl } from '../lib/utils';
import FileThumbnail from './FileThumbnail';

const MAX_UPLOAD_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB
const MAX_UPLOAD_SIZE_LABEL = '1GB';
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'avi', 'mkv', '3gp', 'ogg', 'wmv', 'm4v'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif', 'bmp', 'avif', 'ico', 'heic'];
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'];

const getExtension = (filename) => {
  if (!filename) return '';
  return filename.split('.').pop().toLowerCase();
};

export default function UploadContainer({ title, category, icon: Icon, supportedText, accept, onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [recentFiles, setRecentFiles] = useState([]);
  const [editingFileId, setEditingFileId] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const toast = useToast();
  const { bumpRefresh, refreshKey } = useFileContext();
  const navigate = useNavigate();
  
  const inputRef = useRef(null);
  const recentClickTimeoutRef = useRef({});

  const toggleFavorite = async (e, fileId) => {
    e?.stopPropagation?.();
    try {
      const res = await api.post(`/files/favorites/toggle/${fileId}`);
      fetchRecentFiles();
      bumpRefresh();
      toast(res.data.isFavorite ? 'Added to favorites!' : 'Removed from favorites!', 'success');
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      toast('Failed to toggle favorite', 'error');
    }
  };

  const handleRecentClick = (e, rf) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('form')) {
      return;
    }
    const fileId = rf._id || rf.id;
    if (recentClickTimeoutRef.current[fileId]) {
      clearTimeout(recentClickTimeoutRef.current[fileId]);
      recentClickTimeoutRef.current[fileId] = null;
      toggleFavorite(e, fileId);
    } else {
      recentClickTimeoutRef.current[fileId] = setTimeout(() => {
        recentClickTimeoutRef.current[fileId] = null;
        navigate(`/viewer/${fileId}`);
      }, 250);
    }
  };

  const fetchRecentFiles = async () => {
    try {
      const res = await api.get(`/files/history?category=${category}&limit=3`);
      setRecentFiles(res.data.items);
    } catch (err) {
      console.error('Failed to fetch recent files', err);
    }
  };

  useEffect(() => {
    // Avoid setState-in-effect lint by invoking async fetch outside render phase.
    queueMicrotask(() => {
      fetchRecentFiles();
    });
    // fetchRecentFiles is re-created when category changes; keep deps strict for clarity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, refreshKey]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFile = (file) => {
    const extension = getExtension(file.name);

    if (category === 'videos') {
      if (!VIDEO_EXTENSIONS.includes(extension) && !file.type.startsWith('video/')) {
        return 'Invalid video file type. Allowed formats: MP4, MOV, WEBM, AVI, MKV.';
      }
    } else if (category === 'images') {
      if (!IMAGE_EXTENSIONS.includes(extension) && !file.type.startsWith('image/')) {
        return 'Invalid image file type.';
      }
    } else if (category === 'documents') {
      if (!DOCUMENT_EXTENSIONS.includes(extension)) {
        return 'Invalid document type. Allowed formats: PDF, DOC, DOCX, XLS, XLSX, TXT.';
      }
    } else {
      if (!file.type) {
        return 'Invalid file type.';
      }
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return `File exceeds ${MAX_UPLOAD_SIZE_LABEL} limit.`;
    }

    return null;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (selectedFile) => {
    const error = validateFile(selectedFile);
    if (error) {
      setErrorMsg(error);
      toast(error, 'error');
      setStatus('error');
      setTimeout(() => {
        setStatus('idle');
        setErrorMsg('');
      }, 3000);
      return;
    }
    setFile(selectedFile);
    uploadFile(selectedFile);
  };

  const uploadFile = async (fileToUpload) => {
    // Prevent duplicate uploads if user double-clicks quickly
    if (uploading) return;

    setUploading(true);
    setProgress(0);
    setStatus('idle');
    setErrorMsg('');

    const CHUNK_SIZE_BY_CATEGORY = {
      documents: 50 * 1024 * 1024, // 50MB chunks
      images: 10 * 1024 * 1024,   // 10MB chunks
      videos: 50 * 1024 * 1024,   // 50MB chunks - fewer requests = faster upload
    };

    const CHUNK_SIZE = CHUNK_SIZE_BY_CATEGORY[category] || (5 * 1024 * 1024);

    // For small videos, avoid chunk-upload + merge overhead and use the existing direct upload route.
    // Since files now store locally (fast), use direct upload for up to 100MB
    const VIDEO_SMALL_DIRECT_UPLOAD_THRESHOLD = 100 * 1024 * 1024; // 100MB
    const shouldUseDirectUpload = (category === 'videos' || category === 'images') && fileToUpload.size <= VIDEO_SMALL_DIRECT_UPLOAD_THRESHOLD;

    // Throttle progress updates to reduce re-render pressure.
    let lastProgressUpdateAt = 0;
    const PROGRESS_UPDATE_MIN_INTERVAL_MS = 120;

    try {
      if (shouldUseDirectUpload) {
        const formData = new FormData();
        formData.append('file', fileToUpload, fileToUpload.name);

        await api.post(`/files/upload/${category}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const now = Date.now();
            if (now - lastProgressUpdateAt < PROGRESS_UPDATE_MIN_INTERVAL_MS) return;
            lastProgressUpdateAt = now;

            const percentCompleted = progressEvent.total
              ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
              : 0;
            setProgress(Math.min(100, percentCompleted));
          },
        });

        setProgress(100);
        setStatus('success');
        toast('Upload completed successfully!', 'success');
        fetchRecentFiles();
        bumpRefresh();
        if (onUploadSuccess) onUploadSuccess();

        setTimeout(() => {
          setStatus('idle');
          setFile(null);
          setProgress(0);
        }, 3000);
        return;
      }

      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const totalChunks = Math.ceil(fileToUpload.size / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileToUpload.size);
        const chunkBlob = fileToUpload.slice(start, end);

        const formData = new FormData();
        formData.append('file', chunkBlob, fileToUpload.name);
        formData.append('chunkIndex', i);
        formData.append('totalChunks', totalChunks);
        formData.append('fileId', fileId);
        formData.append('filename', fileToUpload.name);
        formData.append('category', category);

        await api.post('/files/chunk-upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const now = Date.now();
            if (now - lastProgressUpdateAt < PROGRESS_UPDATE_MIN_INTERVAL_MS) return;
            lastProgressUpdateAt = now;

            if (!progressEvent.total) return;

            const chunkProgress = progressEvent.loaded / progressEvent.total;
            const uploadedBytesSoFar = start + chunkProgress * (end - start);
            const percentCompleted = Math.round((uploadedBytesSoFar / fileToUpload.size) * 100);
            setProgress(Math.min(99, percentCompleted));
          },
        });
      }

      setProgress(100);
      setStatus('success');
      toast('Upload completed successfully!', 'success');
      fetchRecentFiles();
      bumpRefresh();
      if (onUploadSuccess) onUploadSuccess();

      setTimeout(() => {
        setStatus('idle');
        setFile(null);
        setProgress(0);
      }, 3000);
    } catch (err) {
      console.error('Upload failed:', err);
      setStatus('error');
      setErrorMsg(err.response?.data?.message || 'Upload failed.');
      toast(err.response?.data?.message || 'Upload failed.', 'error');

      setTimeout(() => {
        setStatus('idle');
        setFile(null);
        setProgress(0);
        setErrorMsg('');
      }, 3000);
    } finally {
      setUploading(false);
    }
  };


  const triggerSelect = () => {
    inputRef.current?.click();
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Move this file to trash?')) {
      try {
        await api.delete(`/files/${id}`);
        fetchRecentFiles();
        bumpRefresh();
        toast('File moved to trash', 'success');
      } catch (err) {
        console.error('Delete failed', err);
        toast('Failed to delete file', 'error');
      }
    }
  };

  const startRename = (e, file) => {
    e.stopPropagation();
    setEditingFileId(file._id);
    setNewFileName(file.filename);
  };

  const handleRename = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newFileName.trim()) {
      setEditingFileId(null);
      return;
    }
    try {
      await api.patch(`/files/${id}/rename`, { filename: newFileName });
      setEditingFileId(null);
      fetchRecentFiles();
      bumpRefresh();
      toast('File renamed successfully', 'success');
    } catch (err) {
      console.error('Rename failed', err);
      toast('Failed to rename file', 'error');
    }
  };

  const handleDirectDownload = async (e, rf) => {
    e.stopPropagation();
    let startId = null;
    try {
      startId = toast(`Downloading ${rf.filename}...`, 'info', 60000);
      const token = localStorage.getItem('token');
      if (!token) return;
      const fileId = rf._id || rf.id;
      const res = await api.get(`/files/download/${fileId}`, {
        responseType: 'blob',
        params: { dl: '1' },
      });
      const blob = res.data;
      const a = document.createElement('a');
      const url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = rf.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast(`${rf.filename} downloaded`, 'success');
    } catch (err) {
      console.error('Download error', err);
      toast(`Download failed: ${err?.message || 'unknown error'}`, 'error');
    }
  };

  const copyLink = async (e, file) => {
    e.stopPropagation();
    const fileId = file._id || file.id;
    const baseUrl = getFrontendBaseUrl();
    let link = file.isShared && file.shareToken
      ? `${baseUrl}/viewer/${file.shareToken}`
      : `${baseUrl}/viewer/${fileId}`;
    if (link && !link.startsWith('http://') && !link.startsWith('https://')) {
      link = `https://${link}`;
    }
    const ok = await copyLinkToClipboard(link);
    if (ok) {
      toast('Blue clickable URL link copied to clipboard!', 'success');
    } else {
      toast('Failed to copy link.', 'error');
    }
  };

  const getThemeColors = () => {
    return {
      bg: 'bg-[#d4af37]/10',
      text: 'text-[#d4af37]',
      border: 'border-[#d4af37]/30',
      cardBg: 'bg-[#111111]/80',
      cardBorder: 'border-[#d4af37]/20 hover:border-[#d4af37]/40 shadow-xl',
      iconBg: 'bg-[#1a1a1a] border border-[#d4af37]/30',
      accentBg: 'bg-white/5 border border-white/10 text-slate-400',
      progressGradient: 'from-[#B8860B] to-[#D4A437]',
    };
  };

  const theme = getThemeColors();

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Upload Zone */}
      <div
        className={`relative p-8 rounded-[2rem] backdrop-blur-2xl border-2 overflow-hidden flex flex-col items-center justify-center text-center min-h-[300px] cursor-pointer shadow-2xl transition-all duration-300 ${
          dragActive 
            ? 'bg-[#d4af37]/10 border-[#d4af37]/50 scale-105 shadow-[0_0_30px_rgba(212,164,55,0.25)]' 
            : 'bg-[#111111]/80 border-[#d4af37]/20 border-dashed hover:bg-[#1A1A1A] hover:border-[#d4af37]/40'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={triggerSelect}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0" />
        
        <input
          ref={inputRef}
          type="file"
          accept={category === 'documents' ? '.pdf,.doc,.docx,.xls,.xlsx,.txt' : accept}
          onChange={handleChange}
          className="hidden"
        />

        <div className="relative z-10 w-full flex flex-col items-center">
          {status === 'success' ? (
            <div className="flex flex-col items-center text-[#d4af37] relative z-10">
              <CheckCircle size={64} className="mb-4 drop-shadow-[0_0_15px_rgba(212,164,55,0.5)]" />
              <h3 className="text-2xl font-bold text-white">Upload Complete!</h3>
            </div>
          ) : status === 'error' ? (
            <div className="flex flex-col items-center text-rose-400 px-4 relative z-10">
              <XCircle size={64} className="mb-4 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
              <h3 className="text-2xl font-bold text-white">Upload Failed</h3>
              <p className="text-sm mt-2 text-center text-slate-300">{errorMsg}</p>
            </div>
          ) : uploading ? (
            <div className="flex flex-col items-center w-full px-4 md:px-8 relative z-10">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-3xl bg-[#1a1a1a] border border-[#d4af37]/30 flex items-center justify-center animate-pulse">
                  <Icon size={40} className="text-[#d4af37]" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-4 truncate max-w-[200px] md:max-w-xs text-center">
                {file?.name}
              </h3>
              <div className="w-full bg-slate-950/80 rounded-full h-3 overflow-hidden mb-3 relative border border-white/10">
                <div
                  className="bg-gradient-to-r from-[#B8860B] to-[#D4A437] h-full relative transition-all duration-200"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 bg-[length:20px_100%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)]" />
                </div>
              </div>
              <p className="text-sm font-bold text-[#d4af37]">{progress}%</p>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full px-4 relative z-10">
              <div className="w-20 h-20 rounded-3xl bg-[#1a1a1a] border border-[#d4af37]/20 flex items-center justify-center mb-6 shadow-xl relative">
                <Icon size={40} className="text-[#d4af37] relative z-10" />
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-3 tracking-tight">{title}</h2>
              <p className="text-slate-400 text-base mb-6">
                Drag &amp; Drop or <span className="text-[#d4af37] font-semibold cursor-pointer hover:underline">Browse files</span>
              </p>
              <div className="px-5 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 font-medium tracking-wide">
                {supportedText}
              </div>
              <p className="text-xs text-slate-400 mt-3">Max file size: {MAX_UPLOAD_SIZE_LABEL} per upload.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Files Preview */}
      {recentFiles.length > 0 && (
        <Card className="p-5 bg-[#111111]/80 border-[#d4af37]/10">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-200">Recent {title}</h4>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 font-medium">
              {recentFiles.length} files
            </span>
          </div>
          <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto custom-scrollbar pr-2">
            {recentFiles.map(rf => (
              <div 
                key={rf._id} 
                onClick={(e) => handleRecentClick(e, rf)}
                className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-2xl hover:bg-slate-800/80 border border-transparent hover:border-white/5 transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950/50 shrink-0 flex items-center justify-center border border-white/5">
                  <FileThumbnail file={rf} category={category} iconSize={24} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 min-w-0">
                  {editingFileId === rf._id ? (
                    <form onSubmit={(e) => handleRename(e, rf._id)} className="flex items-center">
                      <input
                        autoFocus
                        type="text"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        onBlur={(e) => handleRename(e, rf._id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-slate-950 border border-primary/50 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </form>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-200 truncate pr-2">{rf.filename}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{(rf.size / 1024 / 1024).toFixed(2)} MB</p>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button onClick={(e) => startRename(e, rf)} className="p-2 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors" title="Rename">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={(e) => copyLink(e, rf)} className="p-2 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-colors" title="Copy Link">
                    <Copy size={14} />
                  </button>
                  <button onClick={(e) => handleDirectDownload(e, rf)} className="p-2 rounded-lg hover:bg-purple-500/20 text-purple-400 transition-colors" title="Download">
                    <Download size={14} />
                  </button>
                  <button onClick={(e) => handleDelete(e, rf._id)} className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
