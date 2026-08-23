import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Replace any localhost or 127.0.0.1 origin with a public domain only if a custom non-localhost domain is configured
export function makePublicUrl(url) {
  if (!url) return url;
  const publicBase = getPublicBaseDomain();
  try {
    if ((url.includes('localhost') || url.includes('127.0.0.1')) && !publicBase.includes('localhost') && !publicBase.includes('127.0.0.1')) {
      const parsed = new URL(url);
      return publicBase + parsed.pathname + parsed.search + parsed.hash;
    }
    return url;
  } catch {
    return url;
  }
}

export function getPublicBaseDomain() {
  // Priority 1: User-configured custom domain (stored in localStorage via ShareModal)
  const customDomain = typeof localStorage !== 'undefined' ? localStorage.getItem('vibna_custom_share_domain') : null;
  if (customDomain && customDomain.trim()) {
    let domain = customDomain.trim().replace(/\/+$/, '');
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`;
    }
    return domain;
  }

  // Priority 2: VITE_APP_URL env var — build-time fallback if explicitly configured
  const envUrl = import.meta.env.VITE_APP_URL;
  if (envUrl && envUrl.trim()) {
    let url = envUrl.trim().replace(/\/+$/, '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url;
  }

  // Priority 3: window.location.origin — the live URL the app is actually running on.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  // Priority 4: Fallback
  return 'http://localhost:5173';
}

export function getFrontendBaseUrl() {
  return getPublicBaseDomain();
}

export async function copyLinkToClipboard(url, customLabel = null) {
  if (!url) return false;
  
  // Guarantee http/https protocol so messaging apps (WhatsApp, Telegram, etc.) format it as a blue clickable URL
  let formattedUrl = url;
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }

  const label = customLabel || formattedUrl;
  const htmlContent = `<a href="${formattedUrl}" style="color:#1a73e8;text-decoration:underline;font-weight:600">${label}</a>`;

  try {
    if (typeof window !== 'undefined' && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([formattedUrl], { type: 'text/plain' }),
        })
      ]);
      return true;
    }
  } catch (err) {
    console.warn('[Clipboard] Rich ClipboardItem write failed, falling back to writeText:', err);
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(formattedUrl);
      return true;
    }
  } catch (err) {
    console.warn('[Clipboard] writeText failed, attempting execCommand fallback:', err);
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = formattedUrl;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('[Clipboard] Fallback copy failed:', err);
    return false;
  }
}

export async function shareLinkViaWebShare(url, title) {
  if (!url || !navigator.share) return false;
  let formattedUrl = url;
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }
  try {
    await navigator.share({
      title: title || 'Shared File',
      // IMPORTANT: Do NOT put the URL in `text` — WhatsApp/Telegram concatenate
      // `text` + `url` fields, which causes the link to appear TWICE as plain text.
      // Pass the URL only in the `url` field; messaging apps render it as a
      // blue clickable hyperlink automatically.
      url: formattedUrl
    });
    return true;
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('[WebShare] Native share error:', err);
    }
    return false;
  }
}


