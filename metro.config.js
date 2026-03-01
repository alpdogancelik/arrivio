const fs = require('fs');
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

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@': __dirname,
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolvedPlatform = platform ?? context?.platform;

  if (moduleName.startsWith('@/')) {
    const requestPath = moduleName.slice(2);
    const rootCandidate = path.resolve(__dirname, requestPath);
    const srcCandidate = path.resolve(__dirname, 'src', requestPath);
    const targetPath = fs.existsSync(rootCandidate) || fs.existsSync(`${rootCandidate}.ts`) || fs.existsSync(`${rootCandidate}.tsx`)
      ? rootCandidate
      : srcCandidate;

    return context.resolveRequest(context, targetPath, platform);
  }

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
