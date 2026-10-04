import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Deterministic class composition. `clsx` resolves conditional inputs;
 * `tailwind-merge` then drops an earlier utility that a later one contradicts,
 * so a caller's `className` wins by specificity instead of by the accident of
 * string concatenation order. Every primitive and page composes through this.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
