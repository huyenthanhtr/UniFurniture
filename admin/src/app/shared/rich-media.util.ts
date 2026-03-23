export function normalizeRichMediaHtml(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = String(html || '');

  container.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.style.maxWidth = '100%';
    element.style.boxSizing = 'border-box';
  });

  container.querySelectorAll<HTMLElement>('img, video, iframe').forEach((element) => {
    const rawSrc = element.getAttribute('src') || '';
    if (rawSrc.startsWith('//')) element.setAttribute('src', `https:${rawSrc}`);
    if (rawSrc.startsWith('/uploads/')) element.setAttribute('src', `http://localhost:3000${rawSrc}`);
    element.removeAttribute('width');
    element.removeAttribute('height');
    element.style.display = 'block';
    element.style.width = '70%';
    element.style.maxWidth = '70%';
    element.style.height = 'auto';
    element.style.margin = '14px auto';
    if (element.tagName === 'IFRAME' || element.tagName === 'VIDEO') {
      element.style.aspectRatio = '16 / 9';
    }
  });

  return container.innerHTML;
}
