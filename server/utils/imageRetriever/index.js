const {
  readVectorStore,
  ensureVectorStore,
} = require("../../../shared/imageVectorStore");
const { GemmaEmbedder } = require("../../../shared/gemmaEmbedder");

const embedder = new GemmaEmbedder();

function cosineSimilarity(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
    return 0;
  const dotProduct = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

function sanitizeEntry(entry, index) {
  const { vector, ...rest } = entry;
  return {
    ...rest,
    score: typeof entry.score === "number" ? entry.score : 0,
    label: `Image ${index + 1}`,
  };
}

function buildImageContext(images = []) {
  if (!images.length) return null;
  const lines = images.map((image, idx) => {
    const parts = [
      `Image ${idx + 1}: ${image.image_path}`,
      `Cosine score: ${image.score.toFixed(4)}`,
      image.source_doc ? `Source document: ${image.source_doc}` : null,
      typeof image.page === "number" ? `Page: ${image.page}` : null,
      image.metadata?.ocrText
        ? `OCR summary: ${image.metadata.ocrText}`
        : null,
    ];
    return parts.filter(Boolean).join("\n");
  });

  return `Relevant visual context was retrieved. When answering, reference the images by their label (Image 1, Image 2, etc) where appropriate.\n${lines.join("\n\n")}`;
}

function appendImageReferences(answer = "", images = []) {
  if (!images.length) return answer;
  const references = images
    .map((image) => `${image.label} (${image.image_path})`)
    .join("; ");
  return `${answer}\n\nReferenced images: ${references}`;
}

async function retrieveRelevantImages({ query, topK = 3 }) {
  await ensureVectorStore();
  const store = await readVectorStore();
  if (!store.length) return [];

  const queryVector = await embedder.embedText(query || "");
  const scored = store
    .map((entry) => ({
      ...entry,
      score: cosineSimilarity(queryVector, entry.vector),
    }))
    .filter((entry) => Number.isFinite(entry.score) && entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry, index) => sanitizeEntry(entry, index));

  return scored;
}

module.exports = {
  retrieveRelevantImages,
  buildImageContext,
  appendImageReferences,
};
