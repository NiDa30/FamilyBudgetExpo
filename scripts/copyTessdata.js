const fs = require("fs");
const path = require("path");

const sourceDir = path.join(__dirname, "../assets/tessdata");
const androidDir = path.join(
  __dirname,
  "../android/app/src/main/assets/tessdata"
);
const iosDir = path.join(__dirname, "../ios/tessdata");

// Create directories if not exist
if (!fs.existsSync(androidDir)) {
  fs.mkdirSync(androidDir, { recursive: true });
}
if (!fs.existsSync(iosDir)) {
  fs.mkdirSync(iosDir, { recursive: true });
}

// Copy files
const files = ["eng.traineddata", "vie.traineddata"];
files.forEach((file) => {
  const source = path.join(sourceDir, file);
  const androidDest = path.join(androidDir, file);
  const iosDest = path.join(iosDir, file);

  fs.copyFileSync(source, androidDest);
  fs.copyFileSync(source, iosDest);
  console.log(`✅ Copied ${file}`);
});

console.log("✅ All tessdata files copied!");
