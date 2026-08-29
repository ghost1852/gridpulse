/**
 * Universal Clipboard Copy Helper
 * Works in Secure (HTTPS / localhost) and Insecure (LAN HTTP IP) contexts.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern navigator.clipboard API (supported in Secure Contexts)
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand
    }
  }

  // 2. Fallback for HTTP LAN (e.g. http://192.168.x.x:8000) using textarea
  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    }
  } catch (err) {
    console.warn('Fallback clipboard copy failed:', err);
  }

  return false;
}
