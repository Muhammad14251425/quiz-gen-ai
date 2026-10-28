import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Build variant. EAS sets EAS_BUILD_PROFILE on the build worker; for local
 * builds set APP_VARIANT (e.g. `APP_VARIANT=production npx expo prebuild`).
 */
const variant = process.env.EAS_BUILD_PROFILE ?? process.env.APP_VARIANT ?? 'development';
const isProduction = variant.startsWith('production');
/**
 * Strict offline build: no INTERNET permission and no online street map.
 * Default builds allow the opt-in street map (OpenStreetMap tiles).
 */
const offlineOnly = process.env.OFFLINE_ONLY === '1';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isProduction ? 'Receipt Ledger' : 'Receipt Ledger (Dev)',
  slug: 'receipt-ledger',
  version: '1.0.0',
  scheme: 'receiptledger',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'pk.receiptledger.app',
    supportsTablet: false,
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        'Receipt Ledger reads the receipt screenshots you choose so it can record the payment.',
      NSFaceIDUsageDescription: 'Use Face ID to unlock Receipt Ledger.',
      NSLocationWhenInUseUsageDescription:
        'If you turn it on in Settings, Receipt Ledger saves where you were when you record a transaction. It stays on your device.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'pk.receiptledger.app',
    adaptiveIcon: {
      backgroundColor: '#0E7C66',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Only what the app needs; INTERNET is stripped in production by withOffline.
    permissions: ['android.permission.USE_BIOMETRIC', 'android.permission.USE_FINGERPRINT'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_PHONE_STATE',
    ],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-font',
    'expo-mlkit-ocr',
    '@react-native-community/datetimepicker',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        backgroundColor: '#F6F7F9',
        dark: { image: './assets/splash-icon.png', backgroundColor: '#0D1117' },
      },
    ],
    [
      'expo-share-intent',
      {
        iosActivationRules: { NSExtensionActivationSupportsImageWithMaxCount: 10 },
        androidIntentFilters: ['image/*'],
        androidMultiIntentFilters: ['image/*'],
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Receipt Ledger reads the receipt screenshots you choose so it can record the payment.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'If you turn it on in Settings, Receipt Ledger saves where you were when you record a transaction. It stays on your device.',
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    ['expo-local-authentication', { faceIDPermission: 'Use Face ID to unlock Receipt Ledger.' }],
    ['./plugins/withOffline', { stripInternet: isProduction && offlineOnly }],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    variant,
    onlineMapAvailable: !offlineOnly,
  },
});
