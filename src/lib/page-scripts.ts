export function readPageInfo(): { title: string; url: string; selection: string } {
  return {
    title: document.title,
    url: location.href,
    selection: window.getSelection()?.toString() ?? '',
  };
}
