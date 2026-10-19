import { readFile, writeFile } from "node:fs/promises";

const manifestPath = new URL("../package.json", import.meta.url);
const pagePath = new URL("../public/index.html", import.meta.url);
const [manifestSource, page] = await Promise.all([
  readFile(manifestPath, "utf8"), readFile(pagePath, "utf8"),
]);
const manifest = JSON.parse(manifestSource);
const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(manifest.version);
const marker = /(<span class="site-version">)v(\d+\.\d+\.\d+)(<\/span>)/;
const displayedVersion = marker.exec(page)?.[2];
if (!parts || displayedVersion !== manifest.version) {
  throw new Error("The package and footer versions must match before incrementing.");
}
manifest.version = `${parts[1]}.${parts[2]}.${Number(parts[3]) + 1}`;
const nextPage = page.replace(marker, (_, start, oldVersion, end) => `${start}v${manifest.version}${end}`);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(pagePath, nextPage);
console.log(`Site version: v${manifest.version}`);
