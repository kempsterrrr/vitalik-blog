const fs = require("fs");
const path = require("path");
const { ArDriveTurbo } = require("@ardrive/turbo-sdk");
const glob = require("glob");

async function deployImages() {
  // Load wallet
  const wallet = JSON.parse(fs.readFileSync(process.env.WALLET_PATH, "utf8"));

  // Initialize ArDrive Turbo
  const turbo = new ArDriveTurbo({
    gatewayUrl: process.env.ARDRIVE_NODE_URL,
    wallet,
  });

  // Get all images from the images directory
  const imageFiles = glob.sync("images/**/*.*");
  const imageMap = {};

  for (const imagePath of imageFiles) {
    const fileData = fs.readFileSync(imagePath);
    const fileType = path.extname(imagePath).substring(1);

    console.log(`Uploading ${imagePath}...`);

    try {
      const uploadResponse = await turbo.uploadFile({
        fileData,
        fileType,
        contentType: `image/${fileType}`,
      });

      const arweaveUrl = `https://arweave.net/${uploadResponse.dataTxId}`;
      imageMap[imagePath] = arweaveUrl;

      console.log(`Uploaded ${imagePath} to ${arweaveUrl}`);
    } catch (error) {
      console.error(`Failed to upload ${imagePath}:`, error);
      process.exit(1);
    }
  }

  // Save the image mapping for use in the site deployment
  fs.writeFileSync("image-map.json", JSON.stringify(imageMap, null, 2));
}

deployImages().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
