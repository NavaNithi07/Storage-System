const CATEGORY_CONFIG = {
  images: {
    folder: 'uploads/images',
    allowedMime: [
      'image/jpeg',
      'image/jpg',
      'image/pjpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
      'image/gif',
      'image/bmp',
      'image/avif',
      'image/tiff',
      'image/x-icon',
      'image/heic',
      'image/heif',
    ],
  },
  videos: {
    folder: 'uploads/videos',
    allowedMime: [
      'video/mp4',
      'video/quicktime', // MOV
      'video/webm',
      'video/x-msvideo', // AVI
      'video/avi',
      'video/msvideo',
      'video/x-matroska', // MKV
      'video/mkv',
      'video/x-mkv',
      'video/3gpp',
      'video/ogg',
      'video/mpeg',
      'video/mp2t',
      'video/x-ms-wmv',
    ],
  },
  documents: {
    folder: 'uploads/documents',
    allowedMime: [
      'application/pdf',
      'application/msword', // DOC
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/vnd.ms-excel', // XLS
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      'application/vnd.ms-powerpoint', // PPT
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
      'text/plain', // TXT
      'text/csv',
    ],
  },
};

function normalizeCategory(category) {
  if (!category) return null;
  const c = String(category).toLowerCase();
  if (c === 'image') return 'images';
  if (c === 'video') return 'videos';
  if (c === 'document') return 'documents';
  return ['images', 'videos', 'documents'].includes(c) ? c : null;
}

function getDerivedMimeFromExtension(filename) {
  if (!filename) return null;
  const ext = String(filename).toLowerCase().split('.').pop();
  const mimeMap = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'avif': 'image/avif',
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    '3gp': 'video/3gpp',
    'wmv': 'video/x-ms-wmv',
  };
  return mimeMap[ext] || null;
}

function isAllowedMime(category, mimetype, filename = '') {
  const cfg = CATEGORY_CONFIG[category];
  if (!cfg) return false;

  // 1. Direct allowed MIME check
  if (mimetype && cfg.allowedMime.includes(mimetype)) return true;

  // 2. Generic media type prefix check
  if (category === 'images' && mimetype && mimetype.startsWith('image/')) return true;
  if (category === 'videos' && mimetype && mimetype.startsWith('video/')) return true;

  // 3. Fallback based on filename extension
  if (filename) {
    const derivedMime = getDerivedMimeFromExtension(filename);
    if (derivedMime) {
      if (cfg.allowedMime.includes(derivedMime)) return true;
      if (category === 'images' && derivedMime.startsWith('image/')) return true;
      if (category === 'videos' && derivedMime.startsWith('video/')) return true;
    }
  }

  return false;
}

module.exports = {
  CATEGORY_CONFIG,
  normalizeCategory,
  isAllowedMime,
};


