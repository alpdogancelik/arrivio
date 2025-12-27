const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const sourceExts = config.resolver.sourceExts ?? [];
config.resolver.sourceExts = Array.from(new Set([
  ...sourceExts,
  'web.ts',
  'web.tsx',
  'web.js',
  'web.jsx',
]));

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolvedPlatform = platform ?? context?.platform;

  if (resolvedPlatform === 'web' && moduleName === 'react-native-maps') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src', 'shims', 'react-native-maps.tsx'),
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
