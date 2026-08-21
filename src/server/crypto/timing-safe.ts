/**
 * Constant-Time String Comparison Utility
 * Mitigates cryptographic timing side-channel attacks (CWE-208)
 * by ensuring byte-by-byte comparison takes constant execution time.
 */

export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);

  if (bufA.byteLength !== bufB.byteLength) {
    // Perform dummy loop to mitigate execution duration divergence
    let dummyDiff = bufA.byteLength ^ bufB.byteLength;
    for (let i = 0; i < bufA.byteLength; i++) {
      dummyDiff |= bufA[i] ^ (bufB[i % (bufB.byteLength || 1)] || 0);
    }
    return false;
  }

  let diff = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    diff |= bufA[i] ^ bufB[i];
  }

  return diff === 0;
}
