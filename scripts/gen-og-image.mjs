/**
 * scripts/gen-og-image.mjs
 *
 * Converts public/og-image.svg → public/og-image.png at 1200×630.
 * Run via: node scripts/gen-og-image.mjs
 *
 * sharp is a devDependency; it must be installed before running this script.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "public", "og-image.svg");
const pngPath = join(root, "public", "og-image.png");

if (!existsSync(svgPath)) {
  console.error(`[gen-og-image] SVG source not found: ${svgPath}`);
  process.exit(1);
}

const { default: sharp } = await import("sharp");

const svgBuffer = readFileSync(svgPath);

await sharp(svgBuffer)
  .resize(1200, 630, { fit: "fill" })
  .png({ compressionLevel: 9 })
  .toFile(pngPath);

console.log(`[gen-og-image] Written ${pngPath} (1200×630 PNG)`);
