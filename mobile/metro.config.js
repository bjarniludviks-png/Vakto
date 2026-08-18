// mobile/ lives inside the vakto web repo but is a standalone app —
// block the PARENT repo's node_modules so Metro never resolves the web app's
// react/react-native copies (keep default hierarchical lookup: expo's own
// nested node_modules, e.g. expo/node_modules/expo-asset, need it).
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const parentNodeModules = path.resolve(__dirname, "..", "node_modules");
config.resolver.blockList = [
  new RegExp(`^${parentNodeModules.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/.*`),
];
config.watchFolders = [__dirname];

module.exports = config;
