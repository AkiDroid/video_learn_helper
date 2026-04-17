const fs = require("node:fs/promises");
const path = require("node:path");

const { PDFDocument } = require("pdf-lib");
const sharp = require("sharp");

const SUPPORTED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".tif",
  ".tiff",
  ".gif",
]);

function printUsage() {
  console.log("Usage: node index.js <input-directory> [output.pdf]");
}

function sortByFilename(a, b) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

async function ensureDirectoryExists(directoryPath) {
  const stats = await fs.stat(directoryPath).catch(() => null);

  if (!stats || !stats.isDirectory()) {
    throw new Error(`Input directory does not exist: ${directoryPath}`);
  }
}

async function collectImages(inputDirectory) {
  const entries = await fs.readdir(inputDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) =>
      SUPPORTED_EXTENSIONS.has(path.extname(fileName).toLowerCase()),
    )
    .sort(sortByFilename);
}

async function optimizeImageLosslessly(filePath) {
  const originalBuffer = await fs.readFile(filePath);
  const pipeline = sharp(originalBuffer, { animated: false });
  const metadata = await pipeline.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read image dimensions: ${filePath}`);
  }

  const format = (metadata.format || "").toLowerCase();

  if (format === "jpeg" || format === "jpg") {
    return {
      buffer: originalBuffer,
      pdfFormat: "jpg",
      width: metadata.width,
      height: metadata.height,
    };
  }

  const optimizedPngBuffer = await sharp(originalBuffer, { animated: false })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      effort: 10,
      progressive: false,
    })
    .toBuffer();

  return {
    buffer: optimizedPngBuffer,
    pdfFormat: "png",
    width: metadata.width,
    height: metadata.height,
  };
}

async function buildPdf(inputDirectory, outputPdfPath) {
  await ensureDirectoryExists(inputDirectory);

  const imageNames = await collectImages(inputDirectory);

  if (imageNames.length === 0) {
    throw new Error(`No supported images found in: ${inputDirectory}`);
  }

  const pdf = await PDFDocument.create();

  for (const imageName of imageNames) {
    const imagePath = path.join(inputDirectory, imageName);
    const optimizedImage = await optimizeImageLosslessly(imagePath);
    const embeddedImage =
      optimizedImage.pdfFormat === "jpg"
        ? await pdf.embedJpg(optimizedImage.buffer)
        : await pdf.embedPng(optimizedImage.buffer);

    const page = pdf.addPage([
      optimizedImage.width,
      optimizedImage.height,
    ]);

    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: optimizedImage.width,
      height: optimizedImage.height,
    });

    console.log(`Added: ${imageName}`);
  }

  const pdfBytes = await pdf.save({
    useObjectStreams: true,
  });

  await fs.mkdir(path.dirname(outputPdfPath), { recursive: true });
  await fs.writeFile(outputPdfPath, pdfBytes);

  return {
    outputPdfPath,
    imageCount: imageNames.length,
  };
}

async function main() {
  const [, , inputDirectoryArg, outputPdfArg] = process.argv;

  if (!inputDirectoryArg) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const inputDirectory = path.resolve(inputDirectoryArg);
  const outputPdfPath = outputPdfArg
    ? path.resolve(outputPdfArg)
    : path.join(
        inputDirectory,
        `${path.basename(inputDirectory).replace(/\s+/g, "_")}.pdf`,
      );

  const result = await buildPdf(inputDirectory, outputPdfPath);

  console.log(
    `Done: ${result.imageCount} images merged into ${result.outputPdfPath}`,
  );
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
