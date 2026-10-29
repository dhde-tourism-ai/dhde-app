/**
 * Arabic-Indic digits (٠–٩) across the page while it is in Arabic. Numbers are
 * formatted in many places (tables, Recharts SVG, map cards built as HTML), so
 * the digits are swapped in the rendered text instead of in every formatter.
 * React writes a text node's value on each update, so a swapped node is simply
 * swapped again; form fields, scripts and styles are left alone.
 */
const DIGITS = /[0-9]/g
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE'])

const ARABIC = /[٠-٩]/g
// Between digits, ',' and '.' become the Arabic separators (٬ ٫); '%' after a digit becomes ٪.
const toArabic = (s: string) =>
  s
    .replace(DIGITS, (d) => String.fromCharCode(0x0660 + Number(d)))
    .replace(/(?<=[٠-٩]),(?=[٠-٩])/g, '٬')
    .replace(/(?<=[٠-٩])\.(?=[٠-٩])/g, '٫')
    .replace(/(?<=[٠-٩])%/g, '٪')
const toWestern = (s: string) =>
  s
    .replace(ARABIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/(?<=[0-9])٬(?=[0-9])/g, ',')
    .replace(/(?<=[0-9])٫(?=[0-9])/g, '.')
    .replace(/(?<=[0-9])٪/g, '%')

function swap(node: Node, to: (s: string) => string = toArabic) {
  if (node.nodeType === Node.TEXT_NODE) {
    const v = node.nodeValue
    if (v && !SKIP.has(node.parentElement?.tagName ?? '')) {
      const next = to(v)
      if (next !== v) node.nodeValue = next
    }
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE || SKIP.has((node as Element).tagName)) return
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) swap(n, to)
}

/** Start swapping digits under `root`; returns the function that stops it and restores them. */
export function arabicDigits(root: HTMLElement): () => void {
  swap(root)
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') swap(r.target)
      else r.addedNodes.forEach((n) => swap(n))
    }
  })
  observer.observe(root, { childList: true, subtree: true, characterData: true })
  return () => {
    observer.disconnect()
    // Leaving Arabic: put back the digits of text React won't rewrite.
    swap(root, toWestern)
  }
}
