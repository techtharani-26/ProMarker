/* --------------------------------------------------------------------------
   2B. CLIPBOARD COPY (TITLE AS LINK ON SINGLE CLICK)
   -------------------------------------------------------------------------- */
async function copyTitleAsLink(title, url, format) {
  const cleanTitle = (title || extractDomain(url) || url).trim();
  const activeFormat = format || AppState.data.settings.copyFormat || 'title-link';

  let plainText = `[${cleanTitle}](${url})`;
  if (activeFormat === 'title-url') {
    plainText = `${cleanTitle} - ${url}`;
  } else if (activeFormat === 'url-only') {
    plainText = url;
  }

  const htmlText = `<a href="${escapeHTML(safeHref(url))}">${escapeHTML(cleanTitle)}</a>`;

  try {
    if (navigator.clipboard && window.ClipboardItem && activeFormat === 'title-link') {
      const plainBlob = new Blob([plainText], { type: 'text/plain' });
      const htmlBlob = new Blob([htmlText], { type: 'text/html' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': plainBlob, 'text/html': htmlBlob })]);
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(plainText);
    } else {
      const ta = document.createElement('textarea');
      ta.value = plainText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast(`Copied "${cleanTitle}" as link!`, 'success');
    return true;
  } catch (err) {
    console.warn('Clipboard write error, falling back to text:', err);
    try {
      await navigator.clipboard.writeText(plainText);
      showToast(`Copied "${cleanTitle}" as link!`, 'success');
      return true;
    } catch (e) {
      showToast('Failed to copy to clipboard', 'error');
      return false;
    }
  }
}
