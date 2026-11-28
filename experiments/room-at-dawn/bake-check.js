import { giMeshes, applyBake } from "./vendor/src/core/gi.js";

export function inspectBake(scene, buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 8 || view.getUint32(0, true) !== 0x47494231)
    throw Error("Invalid GI magic");
  const len = view.getUint32(4, true);
  if (8 + len > buffer.byteLength) throw Error("Truncated GI manifest");
  const manifest = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, len)));
  if (manifest.version !== 1 || !Array.isArray(manifest.meshes))
    throw Error("Unsupported GI manifest");
  const start = Math.ceil((8 + len) / 4) * 4;
  const entries = giMeshes(scene),
    byKey = new Map(manifest.meshes.map((m) => [m.key, m]));
  const keys = new Set(entries.map((e) => e.key));
  const missing = entries.filter((e) => !byKey.has(e.key)).map((e) => e.key);
  const mismatch = entries
    .filter((e) => {
      const m = byKey.get(e.key);
      return m && (m.count !== e.count || m.back !== e.back);
    })
    .map((e) => e.key);
  const stale = manifest.meshes.filter((m) => !keys.has(m.key)).map((m) => m.key);
  const invalid = manifest.meshes
    .filter(
      (m) =>
        !Number.isInteger(m.off) ||
        !Number.isInteger(m.count) ||
        m.off < 0 ||
        m.count < 0 ||
        start + 2 * (m.off + m.count * (m.back ? 9 : 6)) > buffer.byteLength,
    )
    .map((m) => m.key);
  const report = {
    expected: entries.length,
    baked: manifest.meshes.length,
    matched: entries.length - missing.length - mismatch.length,
    missing,
    mismatch,
    stale,
    invalid,
    duplicateKeys: manifest.meshes.length - byKey.size,
  };
  window.__giReport = report;
  if (missing.length || mismatch.length || stale.length || invalid.length || report.duplicateKeys)
    throw Error(`GI incompatible: ${JSON.stringify(report)}`);
  const applied = applyBake(scene, buffer);
  if (!applied.ok || applied.stale || applied.applied !== entries.length)
    throw Error(`GI apply failed: ${JSON.stringify(applied)}`);
  return report;
}
