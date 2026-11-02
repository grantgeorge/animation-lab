export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Wrap into [0, period). Handles negatives. */
export const wrap = (t: number, period: number) => ((t % period) + period) % period;

export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Interpolate in log space (used for focal length and distance). */
export const lerpLog = (a: number, b: number, u: number) => Math.exp(lerp(Math.log(a), Math.log(b), u));

export const approxEq = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
