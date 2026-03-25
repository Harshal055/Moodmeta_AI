const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Work around Metro failing to resolve nested semver files from
// sp-react-native-in-app-updates on some installs.
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
	...(config.resolver.extraNodeModules || {}),
	semver: path.resolve(__dirname, "node_modules/semver"),
};

module.exports = withNativeWind(config, { input: "./global.css" });
