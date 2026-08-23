import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ExternalLink, Image as ImageIcon, Video, FileText, Trash2, Edit2, Check, X, Copy, Clock, HardDrive, Star, Share2 } from 'lucide-react';
import api from '../services/api';
import { useToast, useToastApi } from '../context/ToastContext';
import { useFileContext } from '../context/FileContext';
import ShareModal from './ShareModal';
import { copyLinkToClipboard, shareLinkViaWebShare, getFrontendBaseUrl, makePublicUrl } from '../lib/utils';
import FileThumbnail from './FileThumbnail';

const OFFICE_PREVIEW_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export default function HistoryItem({ file, onDelete, onUpdate }) {
  const navigate = useNavigate();
  const { bumpRefresh } = useFileContext();
  const fileId = file._id || file.id;

  const toggleFavorite = async (e) => {
    e?.stopPropagation?.();
    try {
      const res = await api.post(`/files/favorites/toggle/${fileId}`);
      if (onUpdate) onUpdate(res.data);
      bumpRefresh();
      toast(res.data.isFavorite ? 'Added to favorites!' : 'Removed from favorites!', 'success');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      console.error('Failed to toggle favorite:', err.response?.data || err);
      toast(`Error: ${errorMsg}`, 'error');
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(file.filename);
  const [isRenaming, setIsRenaming] = useState(false);
  const toast = useToast();
  const { removeToast } = useToastApi();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const clickTimeoutRef = useRef(null);

  const handleCardClick = (e) => {
    // Ignore click if clicking interactive child elements (buttons, links, inputs, form)
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('form')) {
      return;
    }

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      toggleFavorite(e);
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        navigate(`/viewer/${fileId}`);
      }, 250);
    }
  };

  const handleDelete = async () => {
    // Prevent duplicate click/toast from multiple event sources.
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      await api.delete(`/files/${fileId}`);
      onDelete?.(fileId);
      bumpRefresh();

      // Ensure only one toast per successful request.
      toast('File moved to Trash successfully.', 'success');
    } catch (err) {
      console.error('Failed to delete file', err);
      toast('Failed to delete file', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDirectDownload = async () => {
    let startId = null;
    try {
      startId = toast(`Downloading ${file.filename}...`, 'info', 60000);
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      const res = await api.get(`/files/download/${fileId}`, {
        responseType: 'blob',
        params: { dl: '1' },
      });
      const blob = res.data;

      const a = document.createElement('a');
      const url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      removeToast?.(startId);
      toast(`${file.filename} downloaded`, 'success');
    } catch (err) {
      console.error('Direct download error', err);
      removeToast?.(startId);
      toast(`Download failed: ${err?.message || 'unknown error'}`, 'error');
      navigate(`/viewer/${fileId}`);
    }
  };

  const handleGenerateShare = async () => {
    // If the file is already shared, open the ShareModal directly with existing settings & token
    if (file.isShared && file.shareToken) {
      setIsShareModalOpen(true);
      return;
    }

    try {
      setIsGeneratingShare(true);
      const res = await api.post(`/files/${fileId}/generate-share`);

      // Mutate the file ref so ShareModal can build the canonical URL from shareToken
      file.isShared = true;
      file.shareToken = res.data.shareToken;

      setIsShareModalOpen(true);
    } catch (err) {
      console.error('Failed to generate share link:', err);
      toast('Failed to generate share link', 'error');
    } finally {
      setIsGeneratingShare(false);
    }
  };


  const getIcon = () => {
    switch (file.category) {
      case 'images':
        return <ImageIcon size={32} className="text-[#d4af37] drop-shadow-[0_0_10px_rgba(212,164,55,0.5)]" />;
      case 'videos':
        return <Video size={32} className="text-[#f3e5ab] drop-shadow-[0_0_10px_rgba(243,229,171,0.5)]" />;
      case 'documents':
      default:
        return <FileText size={32} className="text-[#b8860b] drop-shadow-[0_0_10px_rgba(184,134,11,0.5)]" />;
    }
  };

  const getTheme = () => {
    switch (file.category) {
      case 'images': return 'border-[#d4af37]/30 bg-[#d4af37]/5 hover:border-[#d4af37]/50 hover:bg-[#d4af37]/10 hover:shadow-[0_0_20px_rgba(212,164,55,0.1)]';
      case 'videos': return 'border-[#f3e5ab]/30 bg-[#f3e5ab]/5 hover:border-[#f3e5ab]/50 hover:bg-[#f3e5ab]/10 hover:shadow-[0_0_20px_rgba(243,229,171,0.1)]';
      case 'documents':
      default: return 'border-[#b8860b]/30 bg-[#b8860b]/5 hover:border-[#b8860b]/50 hover:bg-[#b8860b]/10 hover:shadow-[0_0_20px_rgba(184,134,11,0.1)]';
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const options = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };


    const handleRename = async (e) => {
    e.preventDefault();
    if (!newName.trim() || newName === file.filename) {
      setIsEditing(false);
      setNewName(file.filename);
      return;
    }
    
    setIsRenaming(true);
    try {
      const res = await api.patch(`/files/${fileId}/rename`, { filename: newName });
      setIsEditing(false);
      if (onUpdate) onUpdate(res.data);
      bumpRefresh();
      toast('File renamed successfully', 'success');
    } catch (err) {
      console.error('Failed to rename', err);
      setNewName(file.filename);
      setIsEditing(false);
      toast('Failed to rename file', 'error');
    } finally {
      setIsRenaming(false);
    }
  };

  // Build the canonical viewer link for the card's quick-link pill
  const getCardUrl = () => {
    const base = getFrontendBaseUrl();
    const token = file.shareToken;
    const fileId = file._id || file.id;
    const raw = token ? `${base}/viewer/${token}` : `${base}/viewer/${fileId}`;
    return makePublicUrl(raw);
  };

  const copyLink = async () => {
    const url = getCardUrl();
    const ok = await copyLinkToClipboard(url);
    toast(ok ? 'Link copied to clipboard!' : 'Failed to copy link.', ok ? 'success' : 'error');
  };

  const getFileTypeLabel = () => {
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
    // For images and videos, show category
    if (file.category === 'images') return 'Image';
    if (file.category === 'videos') return 'Video';
    // Fallback to category or generic type
    return file.category?.charAt(0).toUpperCase() + file.category?.slice(1) || 'File';
  };

  const isPdf = file.fileType === 'application/pdf' || file.filename.toLowerCase().endsWith('.pdf');
  const isOfficeDoc = OFFICE_PREVIEW_TYPES.includes(file.fileType) || /\.(docx?|pptx?|xlsx?)$/i.test(file.filename);

  return (
    <>
    <div
      className={`flex flex-col p-5 rounded-3xl border backdrop-blur-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all duration-300 cursor-pointer ${getTheme()}`}
      onClick={handleCardClick}
    >
      <div className="w-full h-40 rounded-2xl bg-black overflow-hidden relative border border-[#d4af37]/20 mb-4 shadow-inner flex items-center justify-center group-hover:border-[#d4af37]/40 transition-colors">
        {file.category === 'images' || file.category === 'videos' ? (
          <FileThumbnail
            file={file}
            category={file.category}
            className="w-full h-full object-cover"
            iconSize={32}
            controls={false}
          />
        ) : (
          <div>
            {getIcon()}
          </div>
        )}
        <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-[#111111]/80 backdrop-blur-md border border-[#d4af37]/20 text-[10px] font-bold tracking-wider uppercase text-white shadow-sm">
          {getFileTypeLabel()}
        </div>

        {/* Favorite Star Indicator */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite();
          }}
          className="absolute top-3 left-3 p-2 rounded-xl bg-[#111111]/80 border border-[#d4af37]/20 hover:bg-[#1A1A1A] transition-colors"
          title={file.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            size={18}
            className={`${
              file.isFavorite
                ? 'fill-yellow-300 text-yellow-300'
                : 'text-slate-400'
            }`}
          />
        </button>
      </div>

      <div className="flex-1 flex flex-col mb-4">
        {isEditing ? (
          <form onSubmit={handleRename} className="flex items-center gap-2 mb-2 w-full relative">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={isRenaming}
              className="w-full bg-slate-950 border border-primary/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
            />
            <div className="absolute right-1 flex items-center gap-1">
               <button type="submit" disabled={isRenaming} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40">
                 <Check size={14} />
               </button>
               <button type="button" onClick={() => { setIsEditing(false); setNewName(file.filename); }} disabled={isRenaming} className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/40">
                 <X size={14} />
               </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h3 className="text-white font-bold truncate text-base" title={file.filename}>
                {file.filename}
              </h3>
              {file.isFavorite && (
                <Star size={14} className="fill-yellow-300 text-yellow-300" />
              )}
            </div>
            <button onClick={() => setIsEditing(true)} className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 shrink-0">
              <Edit2 size={14} />
            </button>
          </div>
        )}
        
        <div className="flex flex-col gap-1.5 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-slate-500" />
            {formatDate(file.createdAt)}
          </div>
          <div className="flex items-center gap-2">
            <HardDrive size={12} className="text-slate-500" />
            {formatSize(file.size)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-4 border-t border-t-[#d4af37]/20">
        {/* Compact share link pill — one URL, shown once on the card */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center overflow-hidden rounded-xl border border-[#d4af37]/20 bg-[#111111]">
            {(() => {
              const cardUrl = getCardUrl();
              return (
                <a
                  href={cardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 px-2.5 py-1.5 text-xs text-[#3b82f6] hover:text-[#60a5fa] underline font-bold truncate flex items-center gap-1 font-mono"
                  style={{ color: '#3b82f6', textDecoration: 'underline' }}
                  title={cardUrl}
                >
                  <span className="truncate underline">{cardUrl}</span>
                  <ExternalLink size={11} className="shrink-0 text-[#3b82f6]" />
                </a>
              );
            })()}
            <button
              onClick={copyLink}
              className="shrink-0 px-2 py-1.5 text-slate-400 hover:text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors border-l border-[#d4af37]/10"
              title="Copy Link"
            >
              <Copy size={12} />
            </button>
          </div>
        </div>

      <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">

          {/* Videos often fail when proxied as blob downloads; open the viewer/download endpoint directly */}
          {file.category === 'videos' ? (
            <button
              type="button"
              onClick={() => {
                const token = localStorage.getItem('token');
                if (!token) {
                  navigate('/login');
                  return;
                }

                const fileId = file._id || file.id;
                const url = `${window.location.origin}/viewer/${fileId}`;
                // Viewer itself can stream; avoids axios blob memory/download issues for large files.
                window.open(url, '_blank', 'noopener');
              }}
              className="p-2 rounded-xl bg-[#b8860b]/10 text-[#b8860b] hover:bg-[#b8860b]/20 hover:scale-105 transition-all shadow-sm"
              title="View / Download"
            >
              <Download size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDirectDownload}
              className="p-2 rounded-xl bg-[#b8860b]/10 text-[#b8860b] hover:bg-[#b8860b]/20 hover:scale-105 transition-all shadow-sm"
              title="Download"
            >
              <Download size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={handleGenerateShare}
            disabled={isGeneratingShare}
            className={`p-2 rounded-xl transition-all shadow-sm disabled:opacity-50 ${
              (file.isShared || file.shareToken)
                ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 hover:bg-[#d4af37]/30'
                : 'bg-[#f3e5ab]/10 text-[#f3e5ab] hover:bg-[#f3e5ab]/20'
            }`}
            title={(file.isShared || file.shareToken) ? 'Share Settings & Link' : 'Generate Share Link'}
          >
            <Share2 size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="p-2 rounded-xl bg-[#991b1b]/20 text-[#fca5a5] hover:bg-[#991b1b]/40 hover:scale-105 transition-all shadow-sm"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

    </div>

    <ShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        file={file}
      />
    </>
  );
}
