const { getDefaultConfig } = require("@expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add support for .wasm files
config.resolver.assetExts.push("wasm");

// Handle WASM modules
config.resolver.sourceExts = [...config.resolver.sourceExts, "wasm"];

module.exports = config;
