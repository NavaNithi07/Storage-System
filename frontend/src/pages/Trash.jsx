import { useState, useEffect } from 'react';
import { RotateCcw, Trash2, Clock, FileText, Image as ImageIcon, Video, Loader2, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useFileContext } from '../context/FileContext';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmDeleteModal({ file, onConfirm, onCancel, isDeleting }) {
  if (!file) return null;
  return (
    <AnimatePresence>
      <motion.div
        key="confirm-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      >
        <motion.div
          key="confirm-panel"
          initial={{ opacity: 0, scale: 0.90, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.90, y: 20 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          className="relative w-full max-w-md bg-[#111111] border border-rose-500/20 rounded-3xl shadow-[0_0_60px_rgba(244,63,94,0.15)] p-7"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>

          {/* Icon */}
          <div className="flex items-center justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.12)]">
              <Trash2 className="w-8 h-8 text-rose-400" />
            </div>
          </div>

          {/* Text */}
          <h2 className="text-xl font-extrabold text-white text-center mb-2 tracking-tight">
            Delete Permanently?
          </h2>
          <p className="text-slate-400 text-sm text-center mb-1">
            You are about to permanently delete:
          </p>
          <p className="text-white font-semibold text-sm text-center truncate px-4 mb-4" title={file.filename}>
            "{file.filename}"
          </p>

          {/* Warning */}
          <div className="flex items-start gap-2.5 bg-rose-500/8 border border-rose-500/15 rounded-2xl px-4 py-3 mb-6">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-300 leading-relaxed">
              This action <span className="font-bold text-rose-200">cannot be undone</span>. The file will be removed from our servers forever and cannot be recovered.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-semibold text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 h-11 rounded-xl bg-rose-500/90 hover:bg-rose-500 text-white font-bold text-sm transition-all hover:shadow-[0_0_20px_rgba(244,63,94,0.35)] active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isDeleting ? 'Deleting...' : 'Yes, Delete Forever'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Trash() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const [confirmFile, setConfirmFile] = useState(null); // file to confirm delete
  const [isConfirmDeleting, setIsConfirmDeleting] = useState(false);
  const { bumpRefresh, socket } = useFileContext();
  const toast = useToast();

  useEffect(() => {
    if (!socket) return;

    const handleFileDeleted = (deletedId) => {
      setFiles(prev => prev.filter(f => (f._id || f.id) !== deletedId));
    };

    const handleTrashUpdated = (deletedId) => {
      setFiles(prev => prev.filter(f => (f._id || f.id) !== deletedId));
    };

    socket.on('fileDeleted', handleFileDeleted);
    socket.on('trashUpdated', handleTrashUpdated);
    return () => {
      socket.off('fileDeleted', handleFileDeleted);
      socket.off('trashUpdated', handleTrashUpdated);
    };
  }, [socket]);

  const fetchTrash = async () => {
    try {
      setLoading(true);
      const res = await api.get('/files/trash');
      setFiles(res.data.items || []);
    } catch (err) {
      console.error('Failed to fetch trash', err);
      toast('Failed to load trash bin', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const handleRestore = async (id) => {
    setActioningId(id);
    try {
      await api.post(`/files/restore/${id}`);
      setFiles(files.filter(f => (f._id || f.id) !== id));
      bumpRefresh();
      toast('File restored successfully', 'success');
    } catch (err) {
      console.error('Failed to restore file', err);
      toast(err.response?.data?.message || 'Failed to restore file', 'error');
    } finally {
      setActioningId(null);
    }
  };

  // Step 1: user clicks Delete → open confirmation modal
  const requestPermanentDelete = (file) => {
    setConfirmFile(file);
  };

  // Step 2: user confirms → actually delete
  const handleConfirmedDelete = async () => {
    if (!confirmFile) return;
    const id = confirmFile._id || confirmFile.id;
    setIsConfirmDeleting(true);
    try {
      await api.delete(`/files/permanent/${id}`);
      setFiles(prev => prev.filter(f => (f._id || f.id) !== id));
      bumpRefresh();
      toast('File permanently deleted.', 'success');
      setConfirmFile(null);
    } catch (err) {
      console.error('Failed to permanently delete file', err);
      toast(err.response?.data?.message || 'Failed to permanently delete', 'error');
    } finally {
      setIsConfirmDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (!isConfirmDeleting) setConfirmFile(null);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const getFileIcon = (category) => {
    switch (category) {
      case 'images':
        return <ImageIcon className="w-8 h-8 text-[#D4A437]" />;
      case 'videos':
        return <Video className="w-8 h-8 text-[#D4A437]" />;
      default:
        return <FileText className="w-8 h-8 text-[#D4A437]" />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col pb-10">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-[#D4A437] mb-2 flex items-center gap-3">
          Trash Bin
        </h1>
        <p className="text-slate-400 text-lg">
          Items in trash are automatically deleted after 30 days. You can restore them before they are gone.
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-[#d4af37] animate-spin" />
          <span className="text-slate-400 text-sm">Loading deleted files...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 border border-dashed border-white/5 rounded-3xl bg-[#111111]/20">
          <div className="w-16 h-16 rounded-full bg-[#111111] flex items-center justify-center border border-white/5 mb-4 shadow-[0_0_15px_rgba(212,164,55,0.03)]">
            <Trash2 className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-white font-medium text-lg mb-1">Trash is empty</p>
          <p className="text-slate-400 text-sm max-w-xs text-center font-light">
            When you delete files, they will appear here and can be restored.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {files.map((file) => {
              const fileId = file._id || file.id;
              const daysLeft = Math.max(
                0,
                30 - Math.floor((Date.now() - new Date(file.deletedAt || file.updatedAt)) / 86400000)
              );

              return (
                <motion.div
                  key={fileId}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="group rounded-3xl p-[1px] bg-gradient-to-b from-[#d4af37]/10 via-white/5 to-transparent hover:from-[#d4af37]/30 transition-all duration-300 shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
                >
                  <Card className="p-5 bg-[#111111]/95 border-transparent shadow-none hover:shadow-none flex flex-col h-full justify-between">
                    <div>
                      {/* Top bar */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                          {getFileIcon(file.category)}
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{daysLeft} days left</span>
                        </div>
                      </div>

                      {/* File info */}
                      <h3 className="font-bold text-white text-lg truncate mb-1" title={file.filename}>
                        {file.filename}
                      </h3>
                      <p className="text-slate-400 text-sm font-light mb-4 flex items-center gap-1.5">
                        <span>{formatSize(file.size)}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                        <span>Deleted on {formatDate(file.deletedAt || file.updatedAt)}</span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        onClick={() => handleRestore(fileId)}
                        disabled={actioningId !== null}
                        className="flex-1 h-10 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 hover:text-black border border-emerald-500/20 text-emerald-400 font-semibold transition-all duration-200 gap-2 text-sm"
                      >
                        {actioningId === fileId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                        <span>Restore</span>
                      </Button>

                      <Button
                        onClick={() => requestPermanentDelete(file)}
                        disabled={actioningId !== null}
                        className="flex-1 h-10 rounded-xl bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-rose-400 font-semibold transition-all duration-200 gap-2 text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmFile && (
        <ConfirmDeleteModal
          file={confirmFile}
          onConfirm={handleConfirmedDelete}
          onCancel={handleCancelDelete}
          isDeleting={isConfirmDeleting}
        />
      )}
    </div>
  );
}
