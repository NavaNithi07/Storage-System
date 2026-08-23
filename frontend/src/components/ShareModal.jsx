import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  X, Copy, Check, Globe,
  MessageCircle, Send, Mail, Link, ExternalLink,
  Lock, Download, RefreshCw, Trash2, Share2, ShieldCheck,
  Settings, RotateCcw, Eye, EyeOff, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { copyLinkToClipboard, shareLinkViaWebShare, getFrontendBaseUrl, makePublicUrl } from '../lib/utils';

// ── Custom SVG icons ──────────────────────────────────────────────────────────
const FacebookIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

// ── URL builder ──────────────────────────────────────────────────────────────
function buildCanonicalUrl(token, fileId) {
  let base = getFrontendBaseUrl();
  base = base.replace(/\/+$/, '');
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`;
  }
  const path = token || fileId;
  let url = `${base}/viewer/${path}`;
  url = makePublicUrl(url);
  return url;
}

// ── Main Modal ────────────────────────────────────────────────────────────────
const ShareModal = ({ isOpen, onClose, file, shareUrl: _initialShareUrl }) => {
  const toast = useToast();

  // Generate-phase settings
  const [password, setPassword] = useState('');
  const [downloadLimit, setDownloadLimit] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [hasLimit, setHasLimit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Active share state
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [shareStats, setShareStats] = useState({ hasPassword: false, shareDownloadLimit: null, shareDownloads: 0 });
  const [showSettings, setShowSettings] = useState(true);

  // Edit-settings state
  const [editPassword, setEditPassword] = useState('');
  const [editDownloadLimit, setEditDownloadLimit] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Derive URL and stats whenever file changes
  useEffect(() => {
    if (!file) return;
    const token = file.shareToken;
    const fileId = file._id || file.id;
    if (!token && !fileId) return;
    const url = buildCanonicalUrl(token, fileId);
    setCanonicalUrl(url);
    setShareStats({
      hasPassword: !!file.sharePassword || !!file.hasPassword,
      shareDownloadLimit: file.shareDownloadLimit ?? null,
      shareDownloads: file.shareDownloads ?? 0,
    });
    setEditDownloadLimit(file.shareDownloadLimit ? String(file.shareDownloadLimit) : '');
    setEditPassword('');
    setShowPassword(false);
    setShowEditPassword(false);
  }, [file]);

  if (!isOpen || !file) return null;

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    const ok = await copyLinkToClipboard(canonicalUrl);
    if (ok) {
      setCopied(true);
      toast('Link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast('Failed to copy link.', 'error');
    }
  };

  const handleOpenLink = () => {
    window.open(canonicalUrl, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = async () => {
    const success = await shareLinkViaWebShare(canonicalUrl, `Shared: ${file.filename}`);
    if (success) toast('Link shared successfully!', 'success');
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const payload = {};
      if (hasLimit && downloadLimit) payload.downloadLimit = parseInt(downloadLimit, 10);
      if (hasPassword && password) payload.sharePassword = password;

      const fileId = file._id || file.id;
      const res = await api.post(`/files/${fileId}/generate-share`, payload);

      const token = res.data.shareToken;
      const url = buildCanonicalUrl(token, fileId);
      setCanonicalUrl(url);

      file.isShared = true;
      file.shareToken = token;
      file.shareDownloadLimit = payload.downloadLimit || null;
      file.shareDownloads = 0;
      file.hasPassword = hasPassword && !!password;
      file.sharePassword = (hasPassword && !!password) ? 'set' : null;

      setShareStats({
        hasPassword: hasPassword && !!password,
        shareDownloadLimit: payload.downloadLimit || null,
        shareDownloads: 0,
      });

      toast('Secure share link generated!', 'success');
    } catch (err) {
      console.error('[ShareModal] generate error:', err);
      toast(err.response?.data?.message || 'Failed to generate secure link.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async () => {
    setIsRevoking(true);
    try {
      const fileId = file._id || file.id;
      await api.post(`/files/${fileId}/revoke-share`);
      setCanonicalUrl('');
      file.isShared = false;
      file.shareToken = null;
      setShowSettings(false);
      toast('Share link revoked.', 'success');
    } catch (err) {
      console.error('[ShareModal] revoke error:', err);
      toast('Failed to revoke share link.', 'error');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleUpdateSettings = async () => {
    setIsUpdating(true);
    try {
      const fileId = file._id || file.id;
      const payload = {};

      // Password: only include if user typed something
      if (editPassword.trim()) {
        payload.sharePassword = editPassword.trim();
      }

      // Download limit:
      //  - empty string + existing limit → clear it
      //  - empty string + no existing limit → do nothing (don't include)
      //  - has value → set it
      if (editDownloadLimit !== '') {
        const parsed = parseInt(editDownloadLimit, 10);
        if (!isNaN(parsed) && parsed >= 1) {
          payload.downloadLimit = parsed;
        } else {
          // user typed 0 or invalid → treat as clear
          if (shareStats.shareDownloadLimit) {
            payload.clearDownloadLimit = true;
          }
        }
      } else if (shareStats.shareDownloadLimit) {
        // User cleared the field and there was an existing limit → remove it
        payload.clearDownloadLimit = true;
      }

      // Nothing to update
      if (Object.keys(payload).length === 0) {
        toast('No changes to save.', 'info');
        setIsUpdating(false);
        return;
      }

      const res = await api.patch(`/files/${fileId}/update-share`, payload);

      setShareStats({
        hasPassword: res.data.hasPassword,
        shareDownloadLimit: res.data.shareDownloadLimit,
        shareDownloads: res.data.shareDownloads,
      });

      // Update the file ref too
      file.shareDownloadLimit = res.data.shareDownloadLimit;
      file.shareDownloads = res.data.shareDownloads;
      file.hasPassword = res.data.hasPassword;
      file.sharePassword = res.data.hasPassword ? 'set' : null;

      setEditPassword('');
      setEditDownloadLimit(res.data.shareDownloadLimit ? String(res.data.shareDownloadLimit) : '');
      setShowSettings(false);
      toast('Share settings updated!', 'success');
    } catch (err) {
      console.error('[ShareModal] update error:', err);
      toast(err.response?.data?.message || 'Failed to update settings.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetDownloadCount = async () => {
    setIsUpdating(true);
    try {
      const fileId = file._id || file.id;
      const res = await api.patch(`/files/${fileId}/update-share`, { resetDownloads: true });
      setShareStats(prev => ({ ...prev, shareDownloads: 0 }));
      file.shareDownloads = 0;
      toast('Download count reset to 0.', 'success');
    } catch (err) {
      toast('Failed to reset download count.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearPassword = async () => {
    setIsUpdating(true);
    try {
      const fileId = file._id || file.id;
      const res = await api.patch(`/files/${fileId}/update-share`, { clearPassword: true });
      setShareStats(prev => ({ ...prev, hasPassword: false }));
      file.hasPassword = false;
      file.sharePassword = null;
      setEditPassword('');
      toast('Password removed.', 'success');
    } catch (err) {
      toast('Failed to remove password.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Social share options ───────────────────────────────────────────────────
  const enc = encodeURIComponent(canonicalUrl);
  const emailSubject = encodeURIComponent(`Shared: ${file.filename}`);
  const emailBody = encodeURIComponent(canonicalUrl);

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      url: `https://api.whatsapp.com/send?text=${enc}`,
      color: 'bg-[#25D366] hover:bg-[#128C7E]',
    },
    {
      name: 'Facebook',
      iconCustom: FacebookIcon,
      url: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
      color: 'bg-[#1877F2] hover:bg-[#0d65d9]',
    },
    {
      name: 'Telegram',
      icon: Send,
      url: `https://t.me/share/url?url=${enc}`,
      color: 'bg-[#0088cc] hover:bg-[#0077b5]',
    },
    {
      name: 'Gmail',
      icon: Mail,
      url: `https://mail.google.com/mail/?view=cm&fs=1&su=${emailSubject}&body=${emailBody}`,
      color: 'bg-[#EA4335] hover:bg-[#D33426]',
    },
    {
      name: 'Outlook',
      icon: Mail,
      url: `https://outlook.office.com/mail/deeplink/compose?subject=${emailSubject}&body=${emailBody}`,
      color: 'bg-[#0078D4] hover:bg-[#005A9E]',
    },
    {
      name: 'Email App',
      icon: Mail,
      url: `mailto:?subject=${emailSubject}&body=${emailBody}`,
      color: 'bg-[#4B5563] hover:bg-[#374151]',
    },
  ];

  const isActive = !!canonicalUrl && (!!file.isShared || !!file.shareToken);
  const downloadsLeft = shareStats.shareDownloadLimit
    ? shareStats.shareDownloadLimit - (shareStats.shareDownloads || 0)
    : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="relative w-full max-w-2xl bg-[#0e0e0e] border border-[#d4af37]/20 rounded-3xl shadow-[0_0_80px_rgba(212,175,55,0.08)] overflow-hidden flex flex-col md:flex-row"
        >
          {/* ── Left: File Info + QR ─────────────────────────────────────── */}
          <div className="w-full md:w-[42%] bg-[#151515] p-6 border-b md:border-b-0 md:border-r border-[#d4af37]/10 flex flex-col items-center justify-start gap-5">
            {/* Header */}
            <div className="self-start flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#d4af37]" />
              <h3 className="text-white font-bold text-sm tracking-wide uppercase">Secure Sharing</h3>
            </div>

            {/* QR Code */}
            {canonicalUrl ? (
              <div className="bg-white p-3 rounded-2xl shadow-[0_0_25px_rgba(212,175,55,0.15)]">
                <QRCode value={canonicalUrl} size={140} level="M" />
              </div>
            ) : (
              <div className="w-full border-2 border-dashed border-[#d4af37]/15 rounded-2xl p-8 text-center text-zinc-600 text-xs leading-relaxed">
                Generate a link to reveal the QR code
              </div>
            )}

            {/* File meta */}
            <div className="w-full space-y-2 text-left">
              <p className="text-white font-bold text-sm truncate leading-tight" title={file.filename}>
                {file.filename}
              </p>
              <div className="flex items-center gap-2">
                <span className="bg-[#d4af37]/10 text-[#d4af37] px-2 py-0.5 rounded-md font-mono uppercase font-bold text-[10px] tracking-wide">
                  {file.category || 'File'}
                </span>
                <span className="text-zinc-500 text-xs">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>

              {/* Live stats when active */}
              {isActive && (
                <div className="pt-2 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <Lock size={11} className={shareStats.hasPassword ? 'text-amber-400' : 'text-zinc-600'} />
                    <span className={shareStats.hasPassword ? 'text-amber-400' : 'text-zinc-600'}>
                      {shareStats.hasPassword ? 'Password protected' : 'No password'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Download size={11} className={shareStats.shareDownloadLimit ? 'text-sky-400' : 'text-zinc-600'} />
                    <span className={shareStats.shareDownloadLimit ? 'text-sky-400' : 'text-zinc-600'}>
                      {shareStats.shareDownloadLimit
                        ? `${shareStats.shareDownloads}/${shareStats.shareDownloadLimit} downloads used`
                        : 'Unlimited downloads'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Controls ──────────────────────────────────────────── */}
          <div className="w-full md:w-[58%] p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            {!isActive ? (
              /* ── GENERATE SECTION ────────────────────────────────────── */
              <div className="flex flex-col gap-5">
                <div>
                  <h4 className="text-white font-bold text-base mb-0.5">Generate Secure Link</h4>
                  <p className="text-zinc-500 text-xs">Optionally add a password or download limit before sharing.</p>
                </div>

                {/* Password protection */}
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer text-zinc-300 text-sm font-medium select-none">
                    <input
                      type="checkbox"
                      checked={hasPassword}
                      onChange={(e) => setHasPassword(e.target.checked)}
                      className="rounded border-zinc-700 text-[#d4af37] focus:ring-[#d4af37]/30 bg-black"
                    />
                    <Lock size={13} className="text-[#d4af37]" />
                    Password Protected
                  </label>
                  {hasPassword && (
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Set access password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowPassword(v => !v);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white focus:outline-none"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Download limit */}
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer text-zinc-300 text-sm font-medium select-none">
                    <input
                      type="checkbox"
                      checked={hasLimit}
                      onChange={(e) => setHasLimit(e.target.checked)}
                      className="rounded border-zinc-700 text-[#d4af37] focus:ring-[#d4af37]/30 bg-black"
                    />
                    <Download size={13} className="text-[#d4af37]" />
                    Download Limit
                  </label>
                  {hasLimit && (
                    <Input
                      type="number"
                      placeholder="Max downloads allowed"
                      value={downloadLimit}
                      onChange={(e) => setDownloadLimit(e.target.value)}
                      min="1"
                      className="w-full"
                    />
                  )}
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-[#d4af37] hover:bg-[#c2a030] text-black font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  {isGenerating
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
                    : <><Globe className="w-4 h-4" /> Generate Secure Link</>
                  }
                </Button>
              </div>
            ) : (
              /* ── ACTIVE SHARE SECTION ────────────────────────────────── */
              <div className="flex flex-col gap-5">
                {/* Status badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Link Active</span>
                  </div>
                  {downloadsLeft !== null && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${downloadsLeft <= 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-sky-500/10 text-sky-400'}`}>
                      {downloadsLeft <= 0 ? 'Limit reached' : `${downloadsLeft} downloads left`}
                    </span>
                  )}
                </div>

                {/* URL box */}
                <div>
                  <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Link size={11} />
                    Share Link
                  </p>
                  <div className="bg-[#0a0a0a] border border-[#d4af37]/15 rounded-2xl px-4 py-3 flex items-center gap-2 group hover:border-[#d4af37]/35 transition-colors">
                    <a
                      href={canonicalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 text-[#3b82f6] hover:text-[#60a5fa] underline underline-offset-2 text-xs font-mono font-semibold truncate transition-colors"
                      title={canonicalUrl}
                    >
                      {canonicalUrl}
                    </a>
                    <ExternalLink size={13} className="shrink-0 text-zinc-600 group-hover:text-[#3b82f6] transition-colors" />
                  </div>

                  {/* Copy + Open */}
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={handleCopy}
                      className="flex-1 h-10 bg-[#d4af37] hover:bg-[#c2a030] text-black rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={handleOpenLink}
                      className="flex-1 h-10 bg-[#1a1a1a] hover:bg-[#222] border border-[#d4af37]/20 hover:border-[#d4af37]/40 text-zinc-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <ExternalLink size={13} />
                      Open Link
                    </button>
                  </div>
                </div>

                {/* ── Settings collapsible ────────────────────────────── */}
                <div className="border border-zinc-800 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setShowSettings(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Settings size={13} className="text-[#d4af37]" />
                      Edit Share Settings
                    </span>
                    {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showSettings && (
                    <div className="px-4 pb-4 space-y-4 border-t border-zinc-800 pt-4">
                      {/* Password section */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Lock size={11} className="text-[#d4af37]" />
                          Password
                          {shareStats.hasPassword && (
                            <span className="ml-auto text-amber-400 font-normal normal-case">Currently set</span>
                          )}
                        </p>
                        <div className="relative">
                          <Input
                            type={showEditPassword ? 'text' : 'password'}
                            placeholder={shareStats.hasPassword ? 'Enter new password to change' : 'Set a password'}
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            className="w-full pr-10"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowEditPassword(v => !v);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white focus:outline-none"
                            aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                          >
                            {showEditPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        {shareStats.hasPassword && (
                          <button
                            onClick={handleClearPassword}
                            disabled={isUpdating}
                            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                          >
                            <X size={11} /> Remove password
                          </button>
                        )}
                      </div>

                      {/* Download limit section */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Download size={11} className="text-[#d4af37]" />
                          Download Limit
                          {shareStats.shareDownloadLimit && (
                            <span className="ml-auto text-sky-400 font-normal normal-case">
                              {shareStats.shareDownloads}/{shareStats.shareDownloadLimit} used
                            </span>
                          )}
                        </p>
                        <Input
                          type="number"
                          placeholder={shareStats.shareDownloadLimit ? `Current: ${shareStats.shareDownloadLimit}` : 'Enter limit (leave empty to remove)'}
                          value={editDownloadLimit}
                          onChange={(e) => setEditDownloadLimit(e.target.value)}
                          min="1"
                          className="w-full"
                        />
                        {shareStats.shareDownloadLimit && (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={handleResetDownloadCount}
                              disabled={isUpdating}
                              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                            >
                              <RotateCcw size={11} /> Reset count to 0
                            </button>
                            <span className="text-zinc-700 text-xs">·</span>
                            <button
                              onClick={() => setEditDownloadLimit('')}
                              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                            >
                              <X size={11} /> Remove limit
                            </button>
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={handleUpdateSettings}
                        disabled={isUpdating || (!editPassword.trim() && editDownloadLimit === (shareStats.shareDownloadLimit ? String(shareStats.shareDownloadLimit) : ''))}
                        className="w-full h-10 bg-[#d4af37]/90 hover:bg-[#d4af37] text-black text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                      >
                        {isUpdating ? <><RefreshCw size={13} className="animate-spin" /> Saving...</> : 'Save Settings'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* ── Divider ─────────────────────────────────────────── */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-zinc-600 text-[10px] uppercase tracking-widest font-semibold">Share Via</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                {/* ── Social share buttons ─────────────────────────────── */}
                <div className="grid grid-cols-2 gap-2.5">
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="col-span-2 bg-indigo-600 hover:bg-indigo-700 h-10 rounded-xl flex items-center justify-center gap-2 text-white text-xs font-bold transition-all hover:scale-[1.01] active:scale-95 shadow-md"
                    >
                      <Share2 size={13} />
                      Share via System Apps
                    </button>
                  )}

                  {shareOptions.map((opt) => (
                    <a
                      key={opt.name}
                      href={opt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${opt.color} h-10 rounded-xl flex items-center justify-center gap-2 text-white text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md`}
                    >
                      {opt.iconCustom ? <opt.iconCustom size={13} /> : <opt.icon size={13} />}
                      {opt.name}
                    </a>
                  ))}
                </div>

                {/* ── Revoke ──────────────────────────────────────────── */}
                <div className="pt-2 border-t border-zinc-800/60">
                  <Button
                    variant="danger"
                    onClick={handleRevoke}
                    disabled={isRevoking}
                    className="w-full bg-rose-500/8 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 text-xs font-bold h-10 rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <Trash2 size={13} />
                    {isRevoking ? 'Revoking...' : 'Revoke Link Instantly'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ShareModal;
