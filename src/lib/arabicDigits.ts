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
// Digits glued to Latin letters are codes (A2, FY2024, Q5) and stay as they are.
// Separators stay '.' and ',': in this font ٫ and ٬ look alike and like a comma.
// A signed number (+٠.٥, +.٥٤٧, −١٢٪, ×١.٠٥) is isolated left-to-right so its sign stays in front.
const LRI = '\u2066'
const PDI = '\u2069'
const toArabic = (s: string) =>
  s
    .replace(/[A-Za-z]*[0-9]+/g, (m) => (/^[A-Za-z]/.test(m) ? m : m.replace(DIGITS, (d) => String.fromCharCode(0x0660 + Number(d)))))
    .replace(/(?<=[٠-٩])%/g, '٪')
    .replace(/(?<![٠-٩\u2066])([+\-−×])(\.?[٠-٩][٠-٩.,]*٪?)/g, `${LRI}$1$2${PDI}`)
const toWestern = (s: string) =>
  s
    .replace(/[\u2066\u2069]/g, '')
    .replace(ARABIC, (d) => String(d.charCodeAt(0) - 0x0660))
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
  for (const el of [node as Element, ...(node as Element).querySelectorAll('[title]')]) swapTitle(el, to)
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) swap(n, to)
}

// Hover tooltips carry numbers too.
function swapTitle(el: Element, to: (s: string) => string) {
  const v = el.getAttribute('title')
  if (!v) return
  const next = to(v)
  if (next !== v) el.setAttribute('title', next)
}

/** Start swapping digits under `root`; returns the function that stops it and restores them. */
export function arabicDigits(root: HTMLElement): () => void {
  swap(root)
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') swap(r.target)
      else if (r.type === 'attributes') swapTitle(r.target as Element, toArabic)
      else r.addedNodes.forEach((n) => swap(n))
    }
  })
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title'] })
  return () => {
    observer.disconnect()
    // Leaving Arabic: put back the digits of text React won't rewrite.
    swap(root, toWestern)
  }
}
