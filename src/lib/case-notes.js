// The doctor can state which area was imaged (for example "Left hand, little finger").
// It is kept as the first line of the saved notes so no database change is needed.
const AREA_PREFIX = "Area imaged: ";

export function composeNotes(area, notes) {
  const a = (area || "").trim().replace(/\s+/g, " ");
  const n = (notes || "").trim();
  return a ? `${AREA_PREFIX}${a}${n ? `\n\n${n}` : ""}` : n;
}

export function splitNotes(text = "") {
  if (text.startsWith(AREA_PREFIX)) {
    const [first, ...rest] = text.slice(AREA_PREFIX.length).split("\n\n");
    return { area: first, notes: rest.join("\n\n") };
  }
  return { area: "", notes: text };
}
