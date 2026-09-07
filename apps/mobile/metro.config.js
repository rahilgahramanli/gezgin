const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/**
 * pnpm monorepo: Metro həm tətbiqin, həm də kökün `node_modules`-una baxmalıdır.
 * `.npmrc`-də `node-linker=hoisted` təyin olunub — paketlərin çoxu kökdədir.
 */
module.exports = mergeConfig(getDefaultConfig(projectRoot), {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
});
