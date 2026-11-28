export const REVIEWED_RENDERER_SHA256: string;
export function requireReviewedRenderer(source: Uint8Array): void;
export function injectUnique(code: string, slot: string, replacement: string): string;
export function instrumentRenderer(code: string, tap: string): string;
