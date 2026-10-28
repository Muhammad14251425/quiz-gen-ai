/**
 * Expo config plugin that enforces the offline guarantee on Android.
 *
 * With `stripInternet: true` (production builds) it:
 *   1. removes any <uses-permission android:name="android.permission.INTERNET"> from the app manifest;
 *   2. adds a `tools:node="remove"` marker so the Gradle manifest merger also drops INTERNET
 *      requested by any library (React Native, ML Kit telemetry, ...).
 *
 * Development and preview builds keep INTERNET because the dev client needs it to reach Metro.
 */
const { withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

const INTERNET = 'android.permission.INTERNET';
const TOOLS_NS = 'http://schemas.android.com/tools';

/** Pure manifest transform, exported for unit tests. */
function stripInternetPermission(androidManifest) {
  const manifest = androidManifest.manifest;
  manifest.$ = manifest.$ || {};
  manifest.$['xmlns:tools'] = TOOLS_NS;

  const permissions = (manifest['uses-permission'] || []).filter((p) => p.$ && p.$['android:name'] !== INTERNET);
  permissions.push({ $: { 'android:name': INTERNET, 'tools:node': 'remove' } });
  manifest['uses-permission'] = permissions;

  // Some libraries use uses-permission-sdk-23; clear those too.
  if (manifest['uses-permission-sdk-23']) {
    manifest['uses-permission-sdk-23'] = manifest['uses-permission-sdk-23'].filter(
      (p) => p.$ && p.$['android:name'] !== INTERNET,
    );
  }
  return androidManifest;
}

function withOffline(config, props = {}) {
  if (!props.stripInternet) return config;
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = stripInternetPermission(cfg.modResults);
    return cfg;
  });
}

module.exports = createRunOncePlugin(withOffline, 'with-offline', '1.0.0');
module.exports.stripInternetPermission = stripInternetPermission;
