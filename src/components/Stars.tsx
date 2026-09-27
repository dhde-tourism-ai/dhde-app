/** Star display: the filled share is rating / 5. Always paired with the number. */
export function Stars({ value, small = false }: { value: number; small?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <span className="stars" style={{ ['--pct' as string]: `${pct}%`, fontSize: small ? 11 : 13 }} role="img" aria-label={`${value} of 5`}>
      ★★★★★
    </span>
  )
}
