// eslint-disable-next-line @typescript-eslint/no-require-imports
const { stripInternetPermission } = require('../withOffline');

interface Perm {
  $: Record<string, string>;
}

describe('withOffline', () => {
  it('removes INTERNET and marks it for removal from library manifests', () => {
    const manifest = {
      manifest: {
        $: {},
        'uses-permission': [
          { $: { 'android:name': 'android.permission.INTERNET' } },
          { $: { 'android:name': 'android.permission.VIBRATE' } },
        ],
      },
    };
    const out = stripInternetPermission(manifest).manifest;
    const perms = out['uses-permission'] as Perm[];
    expect(out.$['xmlns:tools']).toBe('http://schemas.android.com/tools');
    expect(perms.filter((p) => p.$['android:name'] === 'android.permission.INTERNET')).toEqual([
      { $: { 'android:name': 'android.permission.INTERNET', 'tools:node': 'remove' } },
    ]);
    expect(perms.some((p) => p.$['android:name'] === 'android.permission.VIBRATE')).toBe(true);
  });
});
