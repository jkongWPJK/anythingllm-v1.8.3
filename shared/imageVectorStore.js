const fs = require("fs");
const path = require("path");

const EXTRACTION_DIR = path.resolve(__dirname, "../extracted_img");
const VECTOR_STORE_PATH = path.resolve(EXTRACTION_DIR, "image_vectors.json");

function ensureExtractionDir() {
  if (!fs.existsSync(EXTRACTION_DIR)) {
    fs.mkdirSync(EXTRACTION_DIR, { recursive: true });
  }
}

function ensureVectorStore() {
  ensureExtractionDir();
  if (!fs.existsSync(VECTOR_STORE_PATH)) {
    fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify([]), "utf-8");
  }
}

async function readVectorStore() {
  try {
    ensureVectorStore();
    const raw = await fs.promises.readFile(VECTOR_STORE_PATH, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to read image vector store:", error.message);
    return [];
  }
}

async function writeVectorStore(entries = []) {
  ensureVectorStore();
  await fs.promises.writeFile(
    VECTOR_STORE_PATH,
    JSON.stringify(entries, null, 2),
    "utf-8"
  );
}

async function appendVectorEntry(entry) {
  if (!entry || typeof entry !== "object") return;
  const store = await readVectorStore();
  const filtered = store.filter(
    (item) => item.image_path !== entry.image_path
  );
  filtered.push(entry);
  await writeVectorStore(filtered);
}

async function removeEntriesBySourceDoc(sourceDoc) {
  if (!sourceDoc) return [];
  const store = await readVectorStore();
  const removed = store.filter((item) => item.source_doc === sourceDoc);
  if (removed.length === 0) return [];
  const remaining = store.filter((item) => item.source_doc !== sourceDoc);
  await writeVectorStore(remaining);
  return removed;
}

module.exports = {
  VECTOR_STORE_PATH,
  EXTRACTION_DIR,
  ensureVectorStore,
  readVectorStore,
  writeVectorStore,
  appendVectorEntry,
  removeEntriesBySourceDoc,
};
