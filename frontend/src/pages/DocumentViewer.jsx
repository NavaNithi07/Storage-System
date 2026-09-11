import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, FileText, Loader2, AlertCircle, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize, Minimize, Trash2, Expand, Lock, Share2, Eye, EyeOff } from 'lucide-react';
import api, { API_BASE_URL } from '../services/api';
import { useToast, useToastApi } from '../context/ToastContext';
import ShareModal from '../components/ShareModal';

import { pdfjs, Document, Page } from 'react-pdf';

// Force use of CDN for worker to prevent Vite bundling/CSP/resolution issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { renderAsync } from 'docx-preview';
import * as XLSX from 'xlsx';

export default function DocumentViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const shareTokenQuery = searchParams.get('share');
  
  // Share tokens from crypto.randomBytes(32).toString('hex') are exactly 64 lowercase hex chars with NO dashes.
  // UUIDs (Postgres file IDs) always contain dashes: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.
  // This precise check prevents UUIDs from being misidentified as share tokens.
  const isShareTokenPattern = (str) => str && /^[0-9a-f]{32,}$/.test(str) && !str.includes('-');
  const shareToken = shareTokenQuery || (id && isShareTokenPattern(id) ? id : null);
  
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Password Protection State
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [activePassword, setActivePassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  const toast = useToast();
  const { removeToast } = useToastApi();

  // PDF State
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfError, setPdfError] = useState(null);

  const [fitScreen, setFitScreen] = useState(true); // default to fit width for better UX
  const [containerWidth, setContainerWidth] = useState(0);

  // Other Formats State
  const [xlsxHtml, setXlsxHtml] = useState(null);
  const [docRenderError, setDocRenderError] = useState(null);
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [videoDataUrl, setVideoDataUrl] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [textError, setTextError] = useState(null);

  const docxContainerRef = useRef(null);
  const viewerContainerRef = useRef(null);
  const rootContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => { console.log('[DocumentViewer] mount id=', id); return () => console.log('[DocumentViewer] unmount id=', id); }, [id]);

  const fetchFile = async (pwdToTry = activePassword) => {
    if (!requiresPassword) {
      setLoading(true);
    }
    setError(null);
    setPasswordError('');
    try {
      const token = localStorage.getItem('token');

      // ── PATH A: Opened via a share link ──────────────────────────────────────
      // Password gate is ONLY enforced here (share links).
      if (shareToken) {
        let endpoint = `/files/share/${encodeURIComponent(shareToken)}`;
        if (pwdToTry) endpoint += `?password=${encodeURIComponent(pwdToTry)}`;

        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
        const data = await response.json();

        if (response.ok) {
          setRequiresPassword(false);
          setFile(data);
          return;
        }

        if (response.status === 401 && data.requiresPassword) {
          setRequiresPassword(true);
          if (pwdToTry) setPasswordError('Incorrect password. Please try again.');
          return;
        }

        if (response.status === 410) {
          throw new Error(data.message || 'This share link has expired or reached view limits.');
        }

        throw new Error(data.message || 'Failed to load shared document');
      }

      // ── PATH B: Opened directly (dashboard click) ─────────────────────────────
      // Owner access — never ask for a password.
      if (token) {
        try {
          const { data: authData } = await api.get(`/files/${encodeURIComponent(id)}`);
          if (authData) {
            setRequiresPassword(false);
            setFile(authData);
            return;
          }
        } catch (authErr) {
          const status = authErr.response?.status;
          if (status === 401 || status === 403) {
            navigate('/login', { replace: true });
            return;
          }
          throw authErr;
        }
      } else {
        navigate(`/login?redirect=/viewer/${encodeURIComponent(id)}`, { replace: true });
        return;
      }

      throw new Error('Failed to load document');
    } catch (err) {
      const status = err.response?.status || err.status;
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load document';

      if (status === 401 && !shareToken) {
        console.warn('[DocumentViewer] Auth failed, redirecting to login');
        navigate('/login', { replace: true });
        return;
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFile();
  }, [id, shareToken, navigate]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordInput || verifyingPassword) return;
    setVerifyingPassword(true);
    setPasswordError('');
    setActivePassword(passwordInput);
    await fetchFile(passwordInput);
    setVerifyingPassword(false);
  };

  useEffect(() => {
    if (!viewerContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(viewerContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const isPdf = file?.fileType === 'application/pdf' || file?.filename?.toLowerCase().endsWith('.pdf');
  const isDocx =
    file?.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file?.filename?.toLowerCase().match(/\.(docx)$/i);
  const isXlsx =
    file?.fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file?.filename?.toLowerCase().match(/\.(xlsx?)$/i);
  const isPptx =
    file?.fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    file?.filename?.toLowerCase().match(/\.(pptx?)$/i);

  // Text / document formats
  const isTxt =
    file?.fileType === 'text/plain' ||
    file?.filename?.toLowerCase().match(/\.(txt|log)$/i);

  const isCsv =
    file?.fileType === 'text/csv' ||
    file?.filename?.toLowerCase().match(/\.(csv)$/i);

  const isJson =
    file?.fileType === 'application/json' ||
    file?.filename?.toLowerCase().match(/\.(json)$/i);

  const isXml =
    file?.fileType === 'text/xml' ||
    file?.fileType === 'application/xml' ||
    file?.filename?.toLowerCase().match(/\.(xml)$/i);

  const isMarkdown =
    file?.fileType === 'text/markdown' ||
    file?.filename?.toLowerCase().match(/\.(md|markdown)$/i);

  const isImage = 
    file?.fileType?.startsWith('image/') ||
    file?.filename?.toLowerCase().match(/\.(jpe?g|png|webp|svg|gif)$/i);

  const isVideo =
    file?.fileType?.startsWith('video/') ||
    file?.filename?.toLowerCase().match(/\.(mp4|mov|webm|avi|mkv)$/i);

  const fileId = file?._id || file?.id;
  const _authToken = localStorage.getItem('token');

  const tokenPayload = useMemo(() => {
    if (!_authToken) return null;
    try {
      return JSON.parse(atob(_authToken.split('.')[1]));
    } catch (_) {
      return null;
    }
  }, [_authToken]);

  const currentUser = useMemo(() => {
    try {
      const info = localStorage.getItem('userInfo');
      if (info) return JSON.parse(info);
    } catch (_) {}
    return null;
  }, []);

  const currentUserId = currentUser?._id || currentUser?.id || tokenPayload?.id || tokenPayload?._id;
  const isOwner = file?.isOwner === true || !!(file && currentUserId && (file.userId === currentUserId || file.user === currentUserId));

  const isViewingViaShare = Boolean(shareToken);
  const activeShareIdentifier = shareToken;

  const getMediaFetchUrl = () => {
    if (isViewingViaShare && activeShareIdentifier) {
      let u = `${API_BASE_URL}/files/download-shared/${encodeURIComponent(activeShareIdentifier)}`;
      if (activePassword) u += `?password=${encodeURIComponent(activePassword)}`;
      return u;
    }
    return `${API_BASE_URL}/files/download/${fileId}`;
  };

  const pdfUrl = useMemo(() => {
    if (!isPdf || !file) return null;
    if (isViewingViaShare && activeShareIdentifier) {
      let u = `${API_BASE_URL}/files/download-shared/${encodeURIComponent(activeShareIdentifier)}`;
      if (activePassword) u += `?password=${encodeURIComponent(activePassword)}`;
      return u;
    }
    if (fileId) {
      return `${API_BASE_URL}/files/preview/${fileId}?token=${encodeURIComponent(_authToken || '')}`;
    }
    return null;
  }, [isPdf, file, isViewingViaShare, activeShareIdentifier, activePassword, fileId, _authToken]);

  const pdfSource = useMemo(() => (pdfUrl ? { url: pdfUrl } : null), [pdfUrl]);

  const isSupported =
    isPdf ||
    isDocx ||
    isXlsx ||
    isImage ||
    isVideo ||
    isPptx ||
    isTxt ||
    isCsv ||
    isJson ||
    isXml ||
    isMarkdown;

  useEffect(() => {
    if (!file) return;

    let imageObjectUrl = null;
    let videoObjectUrl = null;

    const fetchWithTimeout = async (url, options, timeout = 60000) => {
      const controller = new AbortController();

      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return res;
      } catch (err) {
        clearTimeout(id);
        throw err;
      }
    };

    const fetchImage = async () => {
      if (!isImage) return;
      try {
        const token = localStorage.getItem('token');
        const url = getMediaFetchUrl();
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetchWithTimeout(url, { headers }, 30000);
        if (!res.ok) {
          let msg = `Failed to load image (${res.status})`;
          try {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const data = await res.json();
              msg = data.message || msg;
            }
          } catch (_) {}
          throw new Error(msg);
        }

        const blob = await res.blob();
        imageObjectUrl = URL.createObjectURL(blob);
        setImageDataUrl(imageObjectUrl);
      } catch (err) {
        setImageError(err.message || 'Failed to render image.');
      }
    };

    const fetchVideo = async () => {
      if (!isVideo) return;
      try {
        const token = localStorage.getItem('token');
        const url = getMediaFetchUrl();
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetchWithTimeout(url, { headers }, 120000);
        if (!res.ok) {
          let msg = `Failed to load video (${res.status})`;
          try {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const data = await res.json();
              msg = data.message || msg;
            }
          } catch (_) {}
          throw new Error(msg);
        }

        const blob = await res.blob();
        videoObjectUrl = URL.createObjectURL(blob);
        setVideoDataUrl(videoObjectUrl);
      } catch (err) {
        setVideoError(err.message || 'Failed to render video.');
      }
    };

    const renderDocx = async () => {
      if (!isDocx) return;

      let retries = 0;
      while (!docxContainerRef.current && retries < 20) {
        await new Promise(r => setTimeout(r, 100));
        retries++;
      }

      if (!docxContainerRef.current) {
        setDocRenderError('Container not ready for DOCX render.');
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const url = getMediaFetchUrl();
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetchWithTimeout(url, { headers }, 60000);
        if (!res.ok) {
          let msg = `Failed to fetch file (status ${res.status})`;
          try {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const data = await res.json();
              msg = data.message || msg;
            }
          } catch (_) {}
          throw new Error(msg);
        }

        const blob = await res.blob();
        await renderAsync(blob, docxContainerRef.current, null, {
          className: 'docx-viewer-inner',
          inWrapper: false,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          useBase64URL: true,
        });
      } catch (err) {
        setDocRenderError(err.message || 'Failed to render DOCX file. It might be corrupted or unsupported.');
      }
    };

    const renderXlsx = async () => {
      if (!isXlsx) return;
      try {
        const token = localStorage.getItem('token');
        const url = getMediaFetchUrl();
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetchWithTimeout(url, { headers }, 60000);
        if (!res.ok) {
          let msg = `Failed to fetch file (status ${res.status})`;
          try {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const data = await res.json();
              msg = data.message || msg;
            }
          } catch (_) {}
          throw new Error(msg);
        }

        const arrayBuffer = await res.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const html = XLSX.utils.sheet_to_html(sheet);
        setXlsxHtml(html);
      } catch (err) {
        setDocRenderError(err.message || 'Failed to render XLSX file. It might be corrupted or unsupported.');
      }
    };

    const fetchTextContent = async () => {
      if (!(isTxt || isCsv || isJson || isXml || isMarkdown)) return;
      try {
        const token = localStorage.getItem('token');
        const url = getMediaFetchUrl();
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetchWithTimeout(url, { headers }, 10000);
        if (!res.ok) {
          let msg = `Failed to load text (${res.status})`;
          try {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const data = await res.json();
              msg = data.message || msg;
            }
          } catch (_) {}
          throw new Error(msg);
        }

        const text = await res.text();
        setTextContent(text);
      } catch (err) {
        setTextError(err.message || 'Failed to load text content.');
      }
    };

    if (isImage) fetchImage();
    if (isVideo) fetchVideo();
    if (isDocx) renderDocx();
    if (isXlsx) renderXlsx();
    if (isTxt || isCsv || isJson || isXml || isMarkdown) fetchTextContent();

    return () => {
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
      if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    };
  }, [file, id, isPdf, isDocx, isXlsx, isImage, isVideo, shareToken]);

  // Sync current PDF page number with scroll position (updates the top page indicator)
  // Use a requestAnimationFrame scroll handler that finds the page whose top is closest
  // to the viewer container's top. This is simple and reliable across browsers.
  useEffect(() => {
    if (!isPdf || !numPages) return;
    if (!viewerContainerRef.current) return;

    const root = viewerContainerRef.current;
    let rafId = null;

    const collectPages = () => {
      const els = [];
      for (let i = 1; i <= numPages; i++) {
        const el = document.getElementById(`pdf-page-${i}`);
        if (el) els.push(el);
      }
      return els;
    };

    const updateFromScroll = () => {
      rafId = null;
      const pageEls = collectPages();
      if (!pageEls.length) return;
      const rootRect = root.getBoundingClientRect();
      // Use the vertical center of the viewer to determine which page is most visible
      const centerY = rootRect.top + root.clientHeight / 2;
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < pageEls.length; i++) {
        const r = pageEls[i].getBoundingClientRect();
        const pageCenter = r.top + r.height / 2;
        const dist = Math.abs(pageCenter - centerY);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestIndex = i;
        }
      }
      const newPage = bestIndex + 1;
      setPageNumber(prev => (prev === newPage ? prev : newPage));
    };

    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateFromScroll);
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    // Run once after binding
    updateFromScroll();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      root.removeEventListener('scroll', onScroll);
    };
  }, [isPdf, numPages, scale, fitScreen, containerWidth]);

  // Persist viewer scroll position per file id
  useEffect(() => {
    if (!viewerContainerRef.current || !file) return;
    const key = `vibna:viewerScroll:${fileId}`;
    console.log('[DocumentViewer] viewer persistence active for', key);

    // restore saved position if available (only once after pages mount)
    const tryRestore = () => {
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const v = parseInt(raw, 10);
          console.log('[DocumentViewer] tryRestore found', v, 'current scrollTop', viewerContainerRef.current?.scrollTop);
          // Only restore if current scrollTop is 0 (user hasn't scrolled yet)
          // and saved value is greater than 0. This prevents overwriting user scroll.
          if (!isNaN(v) && viewerContainerRef.current && (viewerContainerRef.current.scrollTop === 0 && v > 0)) {
            console.log('[DocumentViewer] restoring viewer scrollTop ->', v);
            viewerContainerRef.current.scrollTop = v;
          } else {
            console.log('[DocumentViewer] skipping restore');
          }
        } else {
          console.log('[DocumentViewer] no saved viewer position for', key);
        }
      } catch (e) { console.error('[DocumentViewer] tryRestore error', e); }
    };

    // wait briefly for content to render (numPages may change)
    let tries = 0;
    const poll = setInterval(() => {
      tries += 1;
      if (viewerContainerRef.current && (viewerContainerRef.current.scrollHeight > 0 || tries > 10)) {
        tryRestore();
        clearInterval(poll);
      }
      if (tries > 10) clearInterval(poll);
    }, 150);

    const save = () => {
      try {
        const v = viewerContainerRef.current?.scrollTop || 0;
        console.log('[DocumentViewer] saving viewer scroll', v, 'to', key);
        sessionStorage.setItem(key, String(v));
      } catch (e) { console.error('[DocumentViewer] save error', e); }
    };

    // Also save periodically while user scrolls (debounced)
    let saveTimer = null;
    const onScroll = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => save(), 250);
    };
    viewerContainerRef.current.addEventListener('scroll', onScroll, { passive: true });

    window.addEventListener('pagehide', save);
    return () => {
      try { save(); } catch (e) { console.error(e); }
      window.removeEventListener('pagehide', save);
      viewerContainerRef.current?.removeEventListener('scroll', onScroll);
      clearInterval(poll);
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, [fileId, numPages]);

  // Keyboard navigation for PDF and Fullscreen
  useEffect(() => {
    if (isPdf && pdfUrl) {
      console.log('--- DEBUGGING PDF PREVIEW ---');
      console.log('PDF URL used by viewer:', pdfUrl);
      const _dbgToken = localStorage.getItem('token');
      console.log('JWT Present:', !!_dbgToken);
      console.log('Preview Endpoint Used:', '/api/files/preview/:id');
      if (_dbgToken) {
        try {
          const payload = JSON.parse(atob(_dbgToken.split('.')[1]));
          console.log('User ID:', payload.id);
        } catch(e) {}
      }
      
      // Perform a HEAD request to check the endpoint
      fetch(pdfUrl, { method: 'HEAD' })
      .then(res => {
        console.log('HTTP Status:', res.status);
        console.log('Response Content-Type:', res.headers.get('content-type'));
        console.log('Response Content-Disposition:', res.headers.get('content-disposition'));
      }).catch(err => {
        console.log('HTTP Status: Failed', err.message);
      });
    }

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (!isPdf || !numPages) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setPageNumber(prev => Math.min(prev + 1, numPages));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setPageNumber(prev => Math.max(prev - 1, 1));
      } else if (e.key === '+' || e.key === '=') {
        setScale(prev => Math.min(prev + 0.2, 3.0));
      } else if (e.key === '-') {
        setScale(prev => Math.max(prev - 0.2, 0.5));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPdf, numPages]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);

    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Note: intentionally avoiding global wheel capture to use native scrolling.

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && rootContainerRef.current) {
      rootContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  const handleDelete = async () => {
    if (deleting || !window.confirm('Move this file to Trash?')) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      await api.delete(`/files/${fileId}`, { headers });
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete file.');
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (downloading || !file) return;
    setDownloading(true);
    const startId = toast(`Downloading ${file.filename}...`, 'info', 60000);
    try {
      const token = localStorage.getItem('token');
      let url = (isViewingViaShare && activeShareIdentifier)
        ? `${API_BASE_URL}/files/download-shared/${encodeURIComponent(activeShareIdentifier)}?dl=1`
        : `${API_BASE_URL}/files/download/${fileId}?dl=1`;

      if (activePassword) {
        url += `&password=${encodeURIComponent(activePassword)}`;
      }
      
      const headers = {};
      if (token && !isViewingViaShare) headers.Authorization = `Bearer ${token}`;
      
      const res = await fetch(url, { headers });

      if (!res.ok) {
        // Try to extract the backend error message
        let errMsg = 'Download failed';
        try {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errData = await res.json();
            errMsg = errData.message || errMsg;
          }
        } catch (_) {}
        removeToast?.(startId);
        toast(errMsg, 'error');
        setDownloading(false);
        return;
      }

      const blob = await res.blob();
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(dlUrl);
      document.body.removeChild(a);
      removeToast?.(startId);
      toast(`${file.filename} downloaded`, 'success');
    } catch (err) {
      removeToast?.(startId);
      toast(`Download failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setDownloading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <Loader2 size={32} className="animate-spin text-[#d4af37]" />
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0a] text-white p-4">
        <div className="w-full max-w-md bg-[#111111] border border-[#d4af37]/30 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-[#d4af37]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#d4af37]/20">
            <Lock size={32} className="text-[#d4af37]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Password Protected Link</h2>
          <p className="text-zinc-400 text-sm mb-6">This shared document requires a password to view.</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter link password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full text-center tracking-widest text-lg py-3 px-10 bg-black border border-zinc-800 rounded-xl text-white focus:border-[#d4af37] focus:outline-none"
                autoFocus
                disabled={verifyingPassword}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passwordError && (
              <p className="text-rose-500 text-xs font-semibold">{passwordError}</p>
            )}
            <button
              type="submit"
              disabled={verifyingPassword || !passwordInput.trim()}
              className="w-full bg-[#d4af37] hover:bg-[#c2a030] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold h-12 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {verifyingPassword ? (
                <>
                  <Loader2 size={18} className="animate-spin text-black" />
                  <span>Unlocking...</span>
                </>
              ) : (
                <span>Unlock Document</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0a] text-white">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
          <div className="w-20 h-20 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mb-2">
            <AlertCircle size={36} className="text-[#d4af37]" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {shareToken ? 'Share Link Unavailable' : 'Document Unavailable'}
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            {shareToken
              ? (error || 'This share link is invalid or the file has been removed.')
              : (error || 'The document could not be found.')}
          </p>
          {shareToken && (
            <div className="mt-2 px-4 py-3 bg-[#1a1a1a] border border-[#d4af37]/20 rounded-xl text-xs text-slate-400 text-left w-full">
              <p className="font-semibold text-[#d4af37] mb-1">Why am I seeing this?</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>The file owner may have revoked access</li>
                <li>The link may have reached its download/view limit</li>
              </ul>
            </div>
          )}
          {!shareToken && (
            <button onClick={() => navigate('/')} className="mt-4 px-6 py-2 bg-[#d4af37] text-black font-bold rounded-xl hover:bg-[#c2a030] transition-colors">
              Return Home
            </button>
          )}
        </div>
      </div>
    );
  }


  return (
    <div ref={rootContainerRef} className="flex flex-col h-screen w-full bg-black text-[#F5F5F5] overflow-hidden font-sans">
      {/* Top Toolbar */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#111111]/90 backdrop-blur-md border-b border-[#d4af37]/20 z-20 shrink-0 h-14 shadow-lg">
        <div className="flex items-center gap-4 flex-1 overflow-hidden">
          {!shareToken && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 bg-transparent hover:bg-[#d4af37]/10 rounded transition-colors text-slate-400 hover:text-[#d4af37] shrink-0"
              title="Go Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          
          <div className="flex flex-col overflow-hidden">
            <h1 className="text-sm font-medium text-gray-200 truncate" title={file.filename}>
              {file.filename}
            </h1>
            {shareToken && (
              <span className="text-[10px] text-emerald-400 font-semibold tracking-wide">🔗 Shared File · Public Access</span>
            )}
          </div>
        </div>

        {/* Center Controls (Zoom & Page Navigation for All Files) */}
        <div className="flex items-center justify-center gap-2 flex-1">
          {isPdf && numPages && (
            <>
              <div className="flex items-center bg-black rounded-lg p-1 border border-[#d4af37]/20 shadow-inner">
                <button 
                  onClick={() => {
                    const p = Math.max(pageNumber - 1, 1);
                    setPageNumber(p);
                    document.getElementById(`pdf-page-${p}`)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  disabled={pageNumber <= 1}
                  className="p-1 hover:bg-[#d4af37]/10 text-slate-300 hover:text-[#d4af37] rounded disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs px-3 text-[#d4af37] font-bold">
                  {pageNumber} <span className="text-slate-500 font-normal">/ {numPages}</span>
                </span>
                <button 
                  onClick={() => {
                    const p = Math.min(pageNumber + 1, numPages);
                    setPageNumber(p);
                    document.getElementById(`pdf-page-${p}`)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  disabled={pageNumber >= numPages}
                  className="p-1 hover:bg-[#d4af37]/10 text-slate-300 hover:text-[#d4af37] rounded disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="w-px h-4 bg-[#d4af37]/20 mx-2"></div>
            </>
          )}

          {/* Universal Zoom Controls */}
          <div className="flex items-center bg-black rounded-lg p-1 border border-[#d4af37]/20 shadow-inner">
            <button 
              onClick={() => { setFitScreen(false); setScale(s => Math.max(parseFloat((s - 0.2).toFixed(1)), 0.4)); }} 
              className="p-1 hover:bg-[#d4af37]/10 text-slate-300 hover:text-[#d4af37] rounded transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut size={16} />
            </button>
            <span 
              onClick={() => { setFitScreen(false); setScale(1.0); }}
              className="text-xs px-2 text-[#d4af37] font-medium min-w-[50px] text-center cursor-pointer hover:underline"
              title="Click to reset to 100%"
            >
              {fitScreen ? 'Fit' : `${Math.round(scale * 100)}%`}
            </span>
            <button 
              onClick={() => { setFitScreen(false); setScale(s => Math.min(parseFloat((s + 0.2).toFixed(1)), 4.0)); }} 
              className="p-1 hover:bg-[#d4af37]/10 text-slate-300 hover:text-[#d4af37] rounded transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn size={16} />
            </button>
          </div>
          <button 
            onClick={() => {
              setFitScreen(!fitScreen);
              if (!fitScreen) setScale(1.0);
            }}
            className={`p-1.5 ml-1 rounded-lg border transition-colors ${fitScreen ? 'bg-[#d4af37]/10 border-[#d4af37]/30 text-[#d4af37]' : 'bg-black border-[#d4af37]/20 hover:bg-[#d4af37]/10 text-slate-400 hover:text-[#d4af37]'}`}
            title={fitScreen ? 'Actual Size (100%)' : 'Fit Screen'}
          >
            {fitScreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 flex-1">
          {!shareToken && isOwner && (
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="p-2 hover:bg-[#d4af37]/10 rounded-lg transition-colors text-[#d4af37] hover:text-[#f3e5ab] flex items-center gap-1.5 text-xs font-semibold"
              title="Share Document Link"
            >
              <Share2 size={16} />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-[#d4af37]/10 rounded-lg transition-colors text-slate-400 hover:text-[#d4af37]"
            title="Toggle Fullscreen"
          >
            <Expand size={16} />
          </button>

          {!shareToken && isOwner && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 hover:bg-[#991b1b]/20 rounded-lg transition-colors text-slate-400 hover:text-[#fca5a5]"
              title="Delete File"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          )}

          <button
            onClick={file?.downloadLimitReached ? undefined : handleDownload}
            disabled={downloading || file?.downloadLimitReached}
            title={file?.downloadLimitReached ? 'Download limit reached' : 'Download'}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all text-sm font-bold border ${
              file?.downloadLimitReached
                ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#d4af37] to-[#B8860B] text-black hover:shadow-[0_0_15px_rgba(212,164,55,0.4)] border-[#d4af37]/50 disabled:opacity-70'
            }`}
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            <span className="hidden sm:inline">
              {downloading ? 'Downloading...' : file?.downloadLimitReached ? 'Limit Reached' : 'Download'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Viewer Area */}
        <div 
          className={`flex-1 relative overflow-auto custom-scrollbar flex justify-center items-start ${isImage || isVideo || isPdf ? 'bg-black' : 'bg-[#111111]'}`} 
          ref={viewerContainerRef}
        >
          {isSupported ? (
            <div
              className={`w-full min-h-full flex flex-col items-center ${(isImage || isVideo || !isSupported) ? 'justify-center' : 'justify-start'} ${isDocx || isXlsx ? 'bg-white' : ''} ${isPdf ? 'py-8' : 'p-4'}`}
              style={{
                transform: (!isPdf && scale !== 1.0) ? `scale(${scale})` : undefined,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
              }}
            >
                {(pdfError || docRenderError || imageError) && (
                  <div className="flex flex-col items-center justify-center p-12 bg-[#1e1e1e] rounded-xl border border-[#333] text-center max-w-md mx-auto">
                    <AlertCircle size={40} className="text-gray-400 mb-4" />
                    <h2 className="text-lg font-medium text-gray-200 mb-2">Failed to render</h2>
                    <p className="text-gray-400 text-sm mb-6">{pdfError?.message || docRenderError || imageError}</p>
                    <button
                      onClick={handleDownload}
                      className="px-6 py-2 bg-white text-black font-medium rounded hover:bg-gray-200 transition-colors"
                    >
                      Download Original
                    </button>
                  </div>
                )}

                {isImage && (
                  <div className="flex items-center justify-center w-full h-full overflow-hidden">
                    {!imageDataUrl && !imageError && (
                       <Loader2 className="animate-spin text-gray-500" size={32} />
                    )}
                    {imageDataUrl && (
                      <img src={imageDataUrl} alt={file.filename} className="max-w-full max-h-full object-contain pointer-events-auto" />
                    )}
                  </div>
                )}

                {isVideo && (
                  <div className="flex items-center justify-center w-full h-full overflow-hidden">
                    {!videoDataUrl && !videoError && (
                       <Loader2 className="animate-spin text-gray-500" size={32} />
                    )}
                    {videoDataUrl && (
                      <video src={videoDataUrl} controls autoPlay className="max-w-full max-h-full object-contain bg-black shadow-2xl" />
                    )}
                  </div>
                )}
                
                {isPptx && (
                  <div className="flex flex-col items-center justify-center p-12 bg-[#1e1e1e] rounded-xl border border-[#333] text-center max-w-md mx-auto shadow-2xl">
                    <FileText size={48} className="text-gray-500 mb-4" />
                    <h2 className="text-lg font-medium text-white mb-2">Presentation File</h2>
                    <p className="text-gray-400 text-sm mb-6">Previewing presentations is not fully supported in the browser yet.</p>
                    <button onClick={handleDownload} className="px-6 py-2 bg-white text-black font-medium rounded hover:bg-gray-200 transition-colors">
                      Download Original File
                    </button>
                  </div>
                )}

                {isPdf && (
                  <div className="flex flex-col items-center w-full max-w-7xl mx-auto">
                    {!pdfSource && !pdfError && (
                      <div className="flex items-center justify-center w-full mt-32">
                        <Loader2 className="animate-spin text-gray-500" size={32} />
                      </div>
                    )}
                    {pdfSource && (
                      <Document
                        file={pdfSource}
                        onLoadSuccess={({ numPages }) => {
                          console.log("Actual PDF pages:", numPages);
                          setNumPages(numPages);
                        }}
                        onLoadError={(err) => {
                          console.error("PDF Load Error:", err);
                          setPdfError(err);
                        }}
                        loading={
                          <div className="flex items-center justify-center py-32">
                            <Loader2 className="animate-spin text-gray-500" size={32} />
                          </div>
                        }
                        className="flex flex-col items-center gap-6 w-full"
                      >
                        {Array.from(new Array(numPages || 0), (el, index) => (
                          <div key={`page_${index + 1}`} id={`pdf-page-${index + 1}`} data-page={index + 1} className="flex justify-center shadow-2xl bg-white mb-4">
                            <Page
                              pageNumber={index + 1}
                              scale={fitScreen ? undefined : scale}
                              width={fitScreen && containerWidth ? Math.min(containerWidth - 32, 1200) : undefined}
                              devicePixelRatio={Math.max(window.devicePixelRatio || 1, 2)}
                              renderMode="canvas"
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              className=""
                              loading={<div className="bg-[#f0f0f0] animate-pulse w-[800px] max-w-full h-[1100px]" />}
                            />
                          </div>
                        ))}
                      </Document>
                    )}
                  </div>
                )}

                {isDocx && <div ref={docxContainerRef} className="w-full max-w-5xl mx-auto min-h-full bg-white text-black docx-wrapper shadow-2xl" />}

                {(isTxt || isCsv || isJson || isXml || isMarkdown) && (
                  <div className="w-full h-full max-w-5xl mx-auto overflow-auto bg-[#1e1e1e] p-6 text-left border border-[#333] rounded shadow-2xl">
                    {textError ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-red-400">{textError}</p>
                      </div>
                    ) : textContent === null ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="animate-spin text-gray-500" size={32} />
                      </div>
                    ) : (
                      <pre className="text-gray-300 font-mono text-sm whitespace-pre-wrap">{textContent}</pre>
                    )}
                  </div>
                )}

                {isXlsx && xlsxHtml && (
                  <div className="w-full h-full bg-white text-black overflow-auto">
                    <style dangerouslySetInnerHTML={{ __html: `
                      .xlsx-viewer table { border-collapse: collapse; width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                      .xlsx-viewer td, .xlsx-viewer th { border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 14px; color: #333; }
                      .xlsx-viewer th { background-color: #f1f5f9; font-weight: 600; }
                      .xlsx-viewer tr:nth-child(even) { background-color: #f8fafc; }
                    `}} />
                    <div className="xlsx-viewer p-8" dangerouslySetInnerHTML={{ __html: xlsxHtml }} />
                  </div>
                )}
                {isXlsx && !xlsxHtml && !docRenderError && (
                  <div className="flex items-center justify-center h-full w-full">
                    <Loader2 className="animate-spin text-gray-400" size={32} />
                  </div>
                )}
              </div>
            
          ) : (
            <div className="flex items-center justify-center h-full w-full">
              <div className="flex flex-col items-center text-center p-8 bg-[#1e1e1e] border border-[#333] rounded-xl max-w-md">
                <FileText size={48} className="text-gray-500 mb-4" />
                <h2 className="text-lg font-medium text-white mb-2">No Preview Available</h2>
                <p className="text-gray-400 text-sm mb-6">This file format cannot be previewed natively in the browser.</p>
                <button onClick={handleDownload} className="px-6 py-2 bg-white text-black font-medium rounded hover:bg-gray-200 transition-colors">
                  Download
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info Panel */}
        <aside className="w-72 bg-[#111111] border-l border-[#222] hidden lg:flex flex-col shrink-0 z-10 shadow-xl">
          <div className="p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-5">File Information</h3>
            
            <div className="space-y-5">
              <div>
                <p className="text-xs text-gray-500 mb-1">Name</p>
                <p className="text-sm text-gray-200 break-all leading-tight">{file.filename}</p>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 mb-1">Size</p>
                <p className="text-sm text-gray-200">{formatSize(file.size)}</p>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 mb-1">Type</p>
                <p className="text-sm text-gray-200 bg-[#222] inline-block px-2 py-1 rounded border border-[#333] mt-1">{file.fileType || 'Unknown'}</p>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 mb-1">Uploaded On</p>
                <p className="text-sm text-gray-200">
                  {new Date(file.createdAt).toLocaleDateString(undefined, { 
                    year: 'numeric', month: 'short', day: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                  })}
                </p>
              </div>

              {isPdf && numPages && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Pages</p>
                  <p className="text-sm text-gray-200">{numPages}</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
      
      <ShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        file={file}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; border: 2px solid #0a0a0a; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
        
        .docx-wrapper { box-shadow: 0 10px 40px rgba(0,0,0,0.5); padding: 40px !important; margin-top: 16px; margin-bottom: 16px; border-radius: 4px; }
      `}</style>
    </div>
  );
}
