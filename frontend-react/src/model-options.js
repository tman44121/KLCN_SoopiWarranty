// Distinguish catalog models that share a display name in the same category.
export function modelOptions(products) {
  const labels = products.map(p => [p.brandName, p.name].filter(Boolean).join(' '));
  const counts = new Map();
  for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
  return products.map((p, i) => ({
    ...p,
    label: counts.get(labels[i]) > 1 ? `${labels[i]} (${p.code})` : labels[i],
  }));
}
