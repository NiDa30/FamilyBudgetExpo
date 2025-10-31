const fs = require("fs");
const path = require("path");

// Path to the expo-sqlite worker file
const workerPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-sqlite",
  "web",
  "worker.ts"
);

// Check if the file exists
if (fs.existsSync(workerPath)) {
  // Read the file content
  let content = fs.readFileSync(workerPath, "utf8");

  // Check if the file already has the patched import
  if (
    !content.includes(
      "import wasmModule from './wa-sqlite/wa-sqlite.wasm?url';"
    )
  ) {
    // Replace the problematic import with a web-compatible one
    content = content.replace(
      "import wasmModule from './wa-sqlite/wa-sqlite.wasm';",
      "import wasmModule from './wa-sqlite/wa-sqlite.wasm?url';"
    );

    // Write the patched content back to the file
    fs.writeFileSync(workerPath, content, "utf8");
    console.log(
      "Successfully patched expo-sqlite worker.ts for web compatibility"
    );
  } else {
    console.log("expo-sqlite worker.ts is already patched");
  }
} else {
  console.log("expo-sqlite worker.ts not found, skipping patch");
}
