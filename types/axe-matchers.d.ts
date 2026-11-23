/**
 * Types for the `toHaveNoViolations` axe-core matcher registered in
 * vitest.setup.ts.
 */
import "vitest";

declare module "vitest" {
  // The type parameter must match vitest's own `Matchers<T = any>`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface Matchers<T = any> {
    toHaveNoViolations(): void;
  }
}
