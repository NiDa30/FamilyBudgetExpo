module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module:react-native-dotenv",
        {
          moduleName: "@env",
          path: ".env",
          blocklist: null,
          allowlist: [
            "FIREBASE_API_KEY",
            "FIREBASE_AUTH_DOMAIN",
            "FIREBASE_PROJECT_ID",
            "FIREBASE_STORAGE_BUCKET",
            "FIREBASE_MESSAGING_SENDER_ID",
            "FIREBASE_APP_ID",
            "FIREBASE_MEASUREMENT_ID",
            "GOOGLE_VISION_API_KEY",
          ],
          safe: false,
          allowUndefined: true,
          verbose: false,
        },
      ],
      // Handle WASM modules
      [
        "babel-plugin-transform-import-meta",
        {
          modules: {
            "expo-sqlite": "./node_modules/expo-sqlite/build/index.js",
          },
        },
      ],
    ],
  };
};
