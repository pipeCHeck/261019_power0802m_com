import { readFile, writeFile } from "node:fs/promises";

const manifestPath = new URL("../package.json", import.meta.url);
const pagePath = new URL("../public/index.html", import.meta.url);
const lockPath = new URL("../package-lock.json", import.meta.url);
const [manifestSource, page, lockSource] = await Promise.all([
  readFile(manifestPath, "utf8"), readFile(pagePath, "utf8"),
  readFile(lockPath, "utf8").catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  }),
]);
const manifest = JSON.parse(manifestSource);
const lock = lockSource ? JSON.parse(lockSource) : null;
const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(manifest.version);
const marker = /(<span class="site-version">)v(\d+\.\d+\.\d+)(<\/span>)/;
const displayedVersion = marker.exec(page)?.[2];
if (!parts || displayedVersion !== manifest.version) {
  throw new Error("The package and footer versions must match before incrementing.");
}
if (lock && (lock.version !== manifest.version || lock.packages?.[""]?.version !== manifest.version)) {
  throw new Error("The lockfile version must match the package before incrementing.");
}
manifest.version = `${parts[1]}.${parts[2]}.${Number(parts[3]) + 1}`;
const nextPage = page.replace(marker, (_, start, oldVersion, end) => `${start}v${manifest.version}${end}`);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
if (lock) {
  lock.version = manifest.version;
  lock.packages[""].version = manifest.version;
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}
await writeFile(pagePath, nextPage);
console.log(`Site version: v${manifest.version}`);
