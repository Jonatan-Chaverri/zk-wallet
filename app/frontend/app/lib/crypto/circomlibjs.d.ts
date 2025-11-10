// Type declarations for circomlibjs
declare module 'circomlibjs' {
  export function buildBabyjub(): Promise<any>;
  export function buildEddsa(): Promise<any>;
  export function buildPoseidon(): Promise<any>;
  export function buildMimc7(): Promise<any>;
}
