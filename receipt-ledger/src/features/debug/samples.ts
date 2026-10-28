/**
 * Dev-only sample receipts (real screenshots supplied for testing). This module
 * is required only behind `__DEV__`, so Metro strips it — and the images — from
 * production bundles.
 */
export const SAMPLE_RECEIPTS: { name: string; key: string; module: number }[] = [
  {
    name: 'Easypaisa → Talha (Raast)',
    key: 'real_01_easypaisa_talha',
    module: require('../../../assets/samples/real_01_easypaisa_talha.jpg'),
  },
  {
    name: 'Easypaisa → Mushtaq',
    key: 'real_02_easypaisa_mushtaq',
    module: require('../../../assets/samples/real_02_easypaisa_mushtaq.jpg'),
  },
  {
    name: 'Easypaisa → Aliza (Meezan)',
    key: 'real_03_easypaisa_aliza',
    module: require('../../../assets/samples/real_03_easypaisa_aliza.jpg'),
  },
  {
    name: 'Easypaisa → Tabsheer',
    key: 'real_04_easypaisa_tabsheer_raast',
    module: require('../../../assets/samples/real_04_easypaisa_tabsheer_raast.jpg'),
  },
  {
    name: 'Easypaisa → Arooba',
    key: 'real_05_easypaisa_arooba',
    module: require('../../../assets/samples/real_05_easypaisa_arooba.jpg'),
  },
  {
    name: 'Easypaisa → Tabsheer (JazzCash)',
    key: 'real_06_easypaisa_tabsheer_jazzcash',
    module: require('../../../assets/samples/real_06_easypaisa_tabsheer_jazzcash.jpg'),
  },
  {
    name: 'myABL funds transfer',
    key: 'real_07_myabl_ft',
    module: require('../../../assets/samples/real_07_myabl_ft.jpg'),
  },
  {
    name: 'NayaPay → StormFiber',
    key: 'real_08_nayapay_stormfiber',
    module: require('../../../assets/samples/real_08_nayapay_stormfiber.jpg'),
  },
  {
    name: 'NayaPay → Meezan (Raast)',
    key: 'real_09_nayapay_raast_meezan',
    module: require('../../../assets/samples/real_09_nayapay_raast_meezan.jpg'),
  },
  {
    name: 'NayaPay retail',
    key: 'real_10_nayapay_retail',
    module: require('../../../assets/samples/real_10_nayapay_retail.jpg'),
  },
  {
    name: 'NayaPay → Muneeb',
    key: 'real_11_nayapay_muneeb',
    module: require('../../../assets/samples/real_11_nayapay_muneeb.jpg'),
  },
  {
    name: 'NayaPay → Daniyal',
    key: 'real_12_nayapay_daniyal',
    module: require('../../../assets/samples/real_12_nayapay_daniyal.jpg'),
  },
];
