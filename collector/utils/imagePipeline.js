const fs = require("fs");
const path = require("path");
const slugify = require("slugify");
const AdmZip = require("adm-zip");
const sharp = require("sharp");
const OCRLoader = require("./OCRLoader");
const {
  appendVectorEntry,
  removeEntriesBySourceDoc,
  EXTRACTION_DIR,
} = require("../../shared/imageVectorStore");
const { GemmaEmbedder } = require("../../shared/gemmaEmbedder");

const embedder = new GemmaEmbedder();

function log(text, ...args) {
  console.log(`\x1b[36m[ImagePipeline]\x1b[0m ${text}`, ...args);
}

function ensureExtractionDir() {
  if (!fs.existsSync(EXTRACTION_DIR)) {
    fs.mkdirSync(EXTRACTION_DIR, { recursive: true });
  }
}

async function cleanupExistingArtifacts(sourceDoc) {
  if (!sourceDoc) return;
  const removedEntries = await removeEntriesBySourceDoc(sourceDoc);
  for (const entry of removedEntries) {
    const absolute = path.resolve(__dirname, "../../../", entry.image_path);
    try {
      if (fs.existsSync(absolute)) fs.rmSync(absolute);
    } catch (error) {
      log(`Failed to remove cached image ${absolute}: ${error.message}`);
    }
  }
}

function buildEmbeddingText({
  document,
  imagePath,
  page,
  ocrText,
  scoreHint,
}) {
  const parts = [
    `Image path: ${imagePath}`,
    document?.title ? `Document title: ${document.title}` : null,
    document?.description ? `Document description: ${document.description}` : null,
    document?.docAuthor ? `Document author: ${document.docAuthor}` : null,
    document?.chunkSource ? `Document source: ${document.chunkSource}` : null,
    document?.location ? `Stored location: ${document.location}` : null,
    typeof page === "number" ? `Page: ${page}` : null,
    scoreHint ? `Similarity hint: ${scoreHint}` : null,
    ocrText ? `OCR Text: ${ocrText}` : "OCR Text: none detected",
  ];
  return parts.filter(Boolean).join("\n");
}

async function embedImageMetadata({ document, imagePath, page, ocrText }) {
  const embeddingText = buildEmbeddingText({ document, imagePath, page, ocrText });
  const vector = await embedder.embedText(embeddingText);
  return { vector, embeddingText };
}

async function extractImagesFromPdf({ filePath, document, options = {} }) {
  const results = [];
  const pdfjs = await import("pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js");
  const buffer = await fs.promises.readFile(filePath);
  const pdfDocument = await pdfjs.getDocument({ data: buffer });
  const totalPages = pdfDocument.numPages;
  const validOps = new Set([
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintJpegXObject,
    pdfjs.OPS.paintInlineImageXObject,
  ]);
  const ocr = new OCRLoader({ targetLanguages: options?.ocr?.langList });

  for (let i = 1; i <= totalPages; i += 1) {
    const page = await pdfDocument.getPage(i);
    const ops = await page.getOperatorList();
    let pageImageIndex = 0;

    for (let opIndex = 0; opIndex < ops.fnArray.length; opIndex += 1) {
      if (!validOps.has(ops.fnArray[opIndex])) continue;

      try {
        const name = ops.argsArray[opIndex][0];
        const img = await page.objs.get(name);
        if (!img || !img.data) continue;

        const { width, height, data } = img;
        const channels = data.length / (width * height);
        const targetDPI = 140;
        const imageBuffer = await sharp(data, {
          raw: { width, height, channels },
          density: targetDPI,
        })
          .resize({
            width: Math.floor(width * (targetDPI / 72)),
            height: Math.floor(height * (targetDPI / 72)),
            fit: "fill",
          })
          .withMetadata({ density: targetDPI })
          .png()
          .toBuffer();

        const safeTitle = slugify(
          `${document?.title || path.basename(filePath)}-${document?.id || "pdf"}`,
          { lower: true, strict: true }
        );
        const fileName = `${safeTitle}-page-${i}-image-${pageImageIndex}.png`;
        const outputPath = path.resolve(EXTRACTION_DIR, fileName);
        await fs.promises.writeFile(outputPath, imageBuffer);

        const relativePath = path.relative(
          path.resolve(__dirname, "../../../"),
          outputPath
        );
        const normalizedPath = relativePath.replace(/\\/g, "/");
        const ocrText = await ocr.ocrImage(outputPath).catch(() => "");

        results.push({
          image_path: normalizedPath,
          page: i,
          ocrText: ocrText || "",
        });
        pageImageIndex += 1;
      } catch (error) {
        log(`Failed to process PDF image on page ${i}: ${error.message}`);
      }
    }
  }

  return results;
}

async function extractImagesFromDocx({ filePath, document }) {
  const results = [];
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  if (!entries?.length) return results;

  const safeTitle = slugify(
    `${document?.title || path.basename(filePath)}-${document?.id || "docx"}`,
    { lower: true, strict: true }
  );

  entries
    .filter((entry) => entry.entryName.startsWith("word/media/"))
    .forEach((entry, index) => {
      try {
        const ext = path.extname(entry.entryName) || ".png";
        const buffer = entry.getData();
        const fileName = `${safeTitle}-image-${index}${ext}`;
        const outputPath = path.resolve(EXTRACTION_DIR, fileName);
        fs.writeFileSync(outputPath, buffer);
        const relativePath = path
          .relative(path.resolve(__dirname, "../../../"), outputPath)
          .replace(/\\/g, "/");
        results.push({ image_path: relativePath, page: null, ocrText: "" });
      } catch (error) {
        log(`Failed to extract DOCX image: ${error.message}`);
      }
    });

  return results;
}

async function copyImageFile({ filePath, document }) {
  const results = [];
  const ext = path.extname(filePath) || ".png";
  const safeTitle = slugify(
    `${document?.title || path.basename(filePath)}-${document?.id || "image"}`,
    { lower: true, strict: true }
  );
  const fileName = `${safeTitle}${ext}`;
  const outputPath = path.resolve(EXTRACTION_DIR, fileName);
  await fs.promises.copyFile(filePath, outputPath);
  const relativePath = path
    .relative(path.resolve(__dirname, "../../../"), outputPath)
    .replace(/\\/g, "/");

  return [{ image_path: relativePath, page: null, ocrText: "" }];
}

async function processDocumentImages({
  type,
  filePath,
  document,
  options = {},
}) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return;
    if (!document) return;

    ensureExtractionDir();
    await cleanupExistingArtifacts(document.location);

    let extracted = [];
    if (type === "pdf") {
      extracted = await extractImagesFromPdf({ filePath, document, options });
    } else if (type === "docx") {
      extracted = await extractImagesFromDocx({ filePath, document });
    } else if (type === "image") {
      extracted = await copyImageFile({ filePath, document });
    }

    if (!extracted.length) {
      log(`No images discovered for ${document?.title || filePath}.`);
      return;
    }

    let fallbackOcr = null;
    for (const result of extracted) {
      try {
        if (!result.ocrText) {
          if (!fallbackOcr) {
            fallbackOcr = new OCRLoader({
              targetLanguages: options?.ocr?.langList,
            });
          }
          const absolutePath = path.resolve(
            __dirname,
            "../../../",
            result.image_path
          );
          result.ocrText =
            (await fallbackOcr.ocrImage(absolutePath).catch(() => "")) || "";
        }

        const { vector, embeddingText } = await embedImageMetadata({
          document,
          imagePath: result.image_path,
          page: result.page,
          ocrText: result.ocrText,
        });

        await appendVectorEntry({
          vector,
          image_path: result.image_path,
          source_doc: document.location || document.url || "",
          page: result.page,
          metadata: {
            title: document.title,
            description: document.description,
            docAuthor: document.docAuthor,
            chunkSource: document.chunkSource,
            ocrText: result.ocrText,
            embeddingText,
          },
        });
      } catch (error) {
        log(`Failed to embed image metadata: ${error.message}`);
      }
    }
  } catch (error) {
    log(`Image processing failed: ${error.message}`);
  }
}

module.exports = { processDocumentImages };
