export function PriceDisplay({ price }: { price: number | null }) {
  if (price === null || price === undefined) return <span className="text-slate-500">N/A</span>;
  return <span className="font-mono">${price.toFixed(2)}</span>;
}
