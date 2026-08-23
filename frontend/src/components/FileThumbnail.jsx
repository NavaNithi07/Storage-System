import { useState, useEffect } from 'react';
import { Image as ImageIcon, Video as VideoIcon, FileText as FileIcon } from 'lucide-react';
import api from '../services/api';

export default function FileThumbnail({
  file,
  category,
  className = 'w-full h-full object-cover',
  iconSize = 24,
  controls = false,
}) {
  const fileCategory = category || file?.category;
  const [previewUrl, setPreviewUrl] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    const fetchPreview = async () => {
      setHasError(false);
      setLoading(true);

      const fileId = file?._id || file?.id;
      if (!fileId) {
        setLoading(false);
        return;
      }

      if (fileCategory !== 'images' && fileCategory !== 'videos') {
        setLoading(false);
        return;
      }

      // If file.fileUrl is already a blob URL or data URL
      if (file?.fileUrl && (file.fileUrl.startsWith('blob:') || file.fileUrl.startsWith('data:'))) {
        setPreviewUrl(file.fileUrl);
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setHasError(true);
          setLoading(false);
          return;
        }

        const res = await api.get(`/files/download/${fileId}`, {
          responseType: 'blob',
          params: { dl: '1' },
        });

        if (cancelled) return;

        const blob = res.data;
        if (blob && blob.size > 0) {
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
        } else {
          setHasError(true);
        }
      } catch (err) {
        console.warn('[FileThumbnail] Failed to fetch thumbnail blob:', err);
        if (!cancelled) {
          if (file?.fileUrl && file.fileUrl.startsWith('http')) {
            setPreviewUrl(file.fileUrl);
          } else {
            setHasError(true);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPreview();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file?._id, file?.id, fileCategory, file?.fileUrl]);

  const renderDefaultIcon = () => {
    switch (fileCategory) {
      case 'images':
        return <ImageIcon size={iconSize} className="text-[#d4af37] drop-shadow-[0_0_10px_rgba(212,164,55,0.5)]" />;
      case 'videos':
        return <VideoIcon size={iconSize} className="text-[#f3e5ab] drop-shadow-[0_0_10px_rgba(243,229,171,0.5)]" />;
      case 'documents':
      default:
        return <FileIcon size={iconSize} className="text-[#b8860b] drop-shadow-[0_0_10px_rgba(184,134,11,0.5)]" />;
    }
  };

  if (fileCategory !== 'images' && fileCategory !== 'videos') {
    return renderDefaultIcon();
  }

  if (hasError || (!previewUrl && !loading)) {
    return renderDefaultIcon();
  }

  if (loading && !previewUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50 animate-pulse">
        {renderDefaultIcon()}
      </div>
    );
  }

  if (fileCategory === 'images') {
    return (
      <img
        src={previewUrl}
        alt=""
        className={className}
        onError={() => setHasError(true)}
      />
    );
  }

  if (fileCategory === 'videos') {
    return (
      <video
        src={previewUrl}
        className={className}
        controls={controls}
        preload="metadata"
        onError={() => setHasError(true)}
      />
    );
  }

  return renderDefaultIcon();
}
