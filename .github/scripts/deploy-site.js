const fs = require("fs");
const path = require("path");
const { ArDriveTurbo } = require("@ardrive/turbo");
const { ArioSDK } = require("@ariesdo/ario-sdk");
const glob = require("glob");

async function updateMarkdownFiles() {
  const imageMap = JSON.parse(fs.readFileSync("image-map.json", "utf8"));
  const markdownFiles = glob.sync("_site/**/*.{md,html}");

  for (const filePath of markdownFiles) {
    let content = fs.readFileSync(filePath, "utf8");

    // Replace all image references with their Arweave URLs
    for (const [localPath, arweaveUrl] of Object.entries(imageMap)) {
      const relativePath = path.relative(process.cwd(), localPath);
      content = content.replace(new RegExp(relativePath, "g"), arweaveUrl);
    }

    fs.writeFileSync(filePath, content);
  }
}

async function deploySite() {
  // Load wallet
  const wallet = JSON.parse(fs.readFileSync(process.env.WALLET_PATH, "utf8"));

  // Initialize ArDrive Turbo and ARIO SDK
  const turbo = new ArDriveTurbo({
    gatewayUrl: process.env.ARDRIVE_NODE_URL,
    wallet,
  });

  const ario = new ArioSDK({
    wallet,
    gatewayUrl: process.env.ARDRIVE_NODE_URL,
  });

  // Update markdown files with Arweave image URLs
  await updateMarkdownFiles();

  // Create a ZIP of the _site directory
  const siteFiles = glob.sync("_site/**/*.*");
  const manifest = {};

  for (const filePath of siteFiles) {
    const fileData = fs.readFileSync(filePath);
    const relativePath = path.relative("_site", filePath);
    const contentType = getContentType(filePath);

    console.log(`Uploading ${filePath}...`);

    try {
      const uploadResponse = await turbo.uploadFile({
        fileData,
        contentType,
      });

      manifest[relativePath] = {
        id: uploadResponse.dataTxId,
      };
    } catch (error) {
      console.error(`Failed to upload ${filePath}:`, error);
      process.exit(1);
    }
  }

  // Upload the manifest
  const manifestData = Buffer.from(JSON.stringify(manifest));
  const manifestResponse = await turbo.uploadFile({
    fileData: manifestData,
    contentType: "application/x.arweave-manifest+json",
  });

  console.log(`Site deployed with manifest TX: ${manifestResponse.dataTxId}`);

  // Update ArNS name
  try {
    await ario.updateRecord({
      name: process.env.ARNS_NAME,
      target: manifestResponse.dataTxId,
    });
    console.log(
      `Updated ArNS name ${process.env.ARNS_NAME} to point to ${manifestResponse.dataTxId}`
    );
  } catch (error) {
    console.error("Failed to update ArNS name:", error);
    process.exit(1);
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".xml": "application/xml",
    ".txt": "text/plain",
    ".md": "text/markdown",
  };
  return contentTypes[ext] || "application/octet-stream";
}

deploySite().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
