# Receipt Ledger

An **offline** personal money tracker for Pakistan. Share a payment-receipt screenshot (JazzCash, Easypaisa, HBL, Meezan, UBL, Allied/myABL, MCB, Bank Alfalah, Faysal, Askari, SadaPay, NayaPay, Konnect, Raast…) to the app. It reads the image on-device, pre-fills the amount, date/time, counterparty and reference, and asks **Sent or Received?**. It then saves the transaction to one of your bank accounts and updates balances immediately.

No server, no login, no analytics, no network calls. All data stays on the device.

---

## Contents

- [Features](#features)
- [Tech stack and compatibility](#tech-stack-and-compatibility)
- [Setup](#setup)
- [Running a development build](#running-a-development-build)
- [Testing the share flow](#testing-the-share-flow)
- [Adding a new bank profile to the parser](#adding-a-new-bank-profile-to-the-parser)
- [How the offline guarantee is enforced](#how-the-offline-guarantee-is-enforced)
- [Project structure](#project-structure)
- [Receipt parser](#receipt-parser)
- [Data model](#data-model)
- [Decisions and defaults](#decisions-and-defaults)
- [Verification status](#verification-status)
- [Known limitations](#known-limitations)
- [Suggested next steps](#suggested-next-steps)

---

## Features

- **Share-to-app import.** The app is a share target for one or many images. It opens straight on the Import screen whether it was closed, in the background, or open on another screen. Several screenshots are processed as a queue ("Receipt 2 of 5").
- **Pipeline: image → downscale → ML Kit OCR → parser → pre-filled form.** Fields the parser is unsure about are highlighted with **Please check**. If OCR finds nothing, the fields stay empty and saving still works.
- **One-handed confirm.** Two big **Sent** / **Received** buttons at the bottom save the receipt; the likely direction is marked _Suggested_. Saving gives haptic feedback and an **Undo** toast.
- **Account preselection.** The app remembers the last account used for each detected bank. Otherwise it picks an account whose bank matches the receipt, then the last account used.
- **Duplicate detection.** It warns when the same reference ID exists, or when the same amount, local day and counterparty exist. You can **Skip**, **Cancel** or **Save anyway**.
- **Counterparty memory.** Saving remembers each counterparty's category and direction. A later receipt with a similar name (fuzzy match) gets the same category pre-filled.
- **Multiple banks and accounts.** Each account has an opening balance. Balances are computed per account, per bank and in total (per currency). Archiving keeps history. Deleting a bank that has transactions offers _Archive_ or a confirmed cascade delete.
- **Manual entry and Import from gallery.** Gallery import runs the same OCR pipeline.
- **Activity.** Search counterparty, note or reference. Filter by account, bank, type, category and date range (this month, last month, last 30 days, custom). Results are grouped by day with a daily net. Tap a row to view or edit it, including the stored receipt image (full screen with zoom), or delete it.
- **Insights** for any month: money out/in/net, top recipients, spending by category and by bank (plain-View bar charts).
- **Data safety.** Zip backup (JSON plus receipt images) exported through the share sheet and restored with the document picker. CSV export. Optional **app lock** (biometrics or device PIN). **Delete all data**.
- **Settings.** Currency, date format, theme (system/light/dark), category management.
- **Onboarding.** Welcome (or restore a backup), add your first bank and account, then a how-to for sharing a screenshot.
- Dark and light themes from shared design tokens, 48dp+ touch targets, accessibility labels and roles, scalable fonts (capped at 1.6×), and English strings in `src/i18n/en.ts` ready for an Urdu locale.

## Tech stack and compatibility

Compatibility was checked against the current stable release, **Expo SDK 58** (React Native 0.88, React 19.3):

| Need                  | Library                                                                                          | Notes                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation            | `expo-router` 58                                                                                 | File-based routes in `app/`, typed routes on                                                                                                                                                                                                             |
| Receive shared images | `expo-share-intent` **9.x**                                                                      | Officially supports SDK 58. Needs a dev build (not Expo Go)                                                                                                                                                                                              |
| On-device OCR         | `expo-mlkit-ocr` 0.2.7                                                                           | Google ML Kit Text Recognition v2. Android uses `com.google.mlkit:text-recognition` (the **bundled** model, not the Play-Services download); iOS uses `GoogleMLKit/TextRecognition`. The fallback `@react-native-ml-kit/text-recognition` was not needed |
| Storage               | `expo-sqlite` with a hand-written migration runner                                               | Kept dependency-light; Drizzle not needed                                                                                                                                                                                                                |
| Files / backup        | `expo-file-system` (new `File`/`Directory` API), `expo-sharing`, `expo-document-picker`, `jszip` |                                                                                                                                                                                                                                                          |
| Images                | `expo-image-manipulator` (downscale), `expo-image`, `expo-image-picker`                          |                                                                                                                                                                                                                                                          |
| State and forms       | `zustand`, `react-hook-form`, `zod` 4                                                            |                                                                                                                                                                                                                                                          |
| Lock / haptics        | `expo-local-authentication`, `expo-haptics`                                                      |                                                                                                                                                                                                                                                          |
| Tests                 | Jest (`jest-expo`); `better-sqlite3` runs the real SQL in tests                                  |                                                                                                                                                                                                                                                          |

## Setup

```bash
cd receipt-ledger
npm install
npm run check        # tsc --noEmit + eslint + jest
```

Individual commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run format`.

> Use `npx expo install <pkg>` when adding packages so versions match SDK 58.

## Quick try in Expo Go (no build needed)

For a quick look at the UI on your phone:

1. Install **Expo Go** (SDK 58) from the Play Store or App Store.
2. On your computer: `cd receipt-ledger && npm install && npm run start:go` (runs `expo start --go --tunnel`; accept the prompt to install `@expo/ngrok`).
3. Scan the QR code with Expo Go (Android) or the Camera app (iOS), or open the `exp://…` link it prints.

Expo Go cannot load custom native code, so in Expo Go:

- Sharing a screenshot _to_ the app does not work, because the share target needs a dev build.
- On-device OCR is unavailable. **From gallery** opens the import form with empty fields and a "could not read" notice.
- Everything else works: banks and accounts, manual entry, Activity, Insights, backup and settings. _Settings → Developer → Debug tools → Simulate share without OCR_ walks through the full import flow using the recorded text of the 12 sample receipts.

Use a development build (below) to test sharing and real OCR.

## Running a development build

Native modules (share intent, ML Kit, SQLite) mean **Expo Go will not work**. You need a development build.

**EAS (cloud):**

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android   # installable APK
npx eas-cli@latest build --profile development --platform ios       # needs an Apple developer account
npx expo start --dev-client
```

**Local alternative** (Android Studio and JDK 17 installed):

```bash
npx expo run:android          # prebuilds android/, builds, installs and starts Metro
npx expo run:ios              # macOS + Xcode
```

`eas.json` profiles:

| Profile       | Purpose                    | INTERNET permission |
| ------------- | -------------------------- | ------------------- |
| `development` | Dev client, talks to Metro | kept                |
| `preview`     | Internal APK for testers   | kept                |
| `production`  | Store build (AAB)          | **removed**         |

The profile reaches `app.config.ts` through `EAS_BUILD_PROFILE` on EAS or `APP_VARIANT` locally (`APP_VARIANT=production npx expo prebuild`).

## Testing the share flow

1. Install the dev build and finish onboarding (add a bank and account).
2. Take or open a receipt screenshot in **Google Photos / Gallery** (Android) or **Photos** (iOS). Tap **Share**, then **Receipt Ledger** (Android) or the Receipt Ledger share extension (iOS).
3. The app opens on **Import receipt**. Check the highlighted fields and tap **Sent** or **Received**.
4. Repeat with several images selected at once to test the queue. Try it from a cold start, from the background, and while the app is open on another tab.

**Without a phone camera roll.** _Settings → Developer → Debug tools_ (dev builds only) has:

- **Load sample banks & transactions**: four banks, five accounts and two months of data.
- **Share all 12 receipts to the app**: pushes the bundled real sample screenshots (`assets/samples/`) through the **real** OCR pipeline.
- **Simulate share without OCR (emulator)**: uses the recorded OCR text of the same receipts, for emulators where ML Kit is unavailable.

**On an emulator:** `adb push some-receipt.png /sdcard/Pictures/`, then open it in the Photos/Files app and share it to Receipt Ledger. ML Kit runs on emulators with Google APIs images.

## Adding a new bank profile to the parser

Profiles are data in `src/parser/bankProfiles.ts`. The parser logic does not change:

```ts
{
  id: 'bop',                       // stable id (stored as the bank's preset)
  name: 'Bank of Punjab',
  color: '#00843D',
  kind: 'bank',                    // 'bank' | 'wallet' | 'rail'
  keywords: ['bank of punjab', 'bop'],   // matched case-insensitively on word boundaries
  priority: 1,                     // optional: <1 for rails like Raast, >1 for sub-brands like Konnect
  layoutHints: [],                 // optional weak phrases for logo-only receipts
  counterpartyLabels: [],          // optional extra labels that introduce the payee
  referenceLabels: [],             // optional extra labels for the transaction ID
}
```

Then add a fixture: put the OCR text in `src/parser/__fixtures__/NN_bank_case.txt` and the expected fields in `__fixtures__/cases.ts`, and run `npm test`. The new bank also shows up automatically in the "Add bank" preset grid.

Detection rules: a keyword in the first 3 lines scores ×2. A "Sent with / Paid with / Powered by X" line scores ×3. Lines like "Beneficiary/Destination Bank: …" are ignored so the _other_ party's bank never wins.

## How the offline guarantee is enforced

- **No INTERNET permission in production Android builds.** `plugins/withOffline.js` (enabled when the variant is `production`) removes `android.permission.INTERNET` from the app manifest. It also adds `<uses-permission android:name="android.permission.INTERNET" tools:node="remove"/>` so the Gradle manifest merger drops INTERNET requested by _any_ library, including React Native and ML Kit's telemetry. Development and preview builds keep it for Metro.
  - Verify: `APP_VARIANT=production npx expo prebuild -p android --clean && npm run verify:offline`. After a release build, `npm run verify:offline` checks the merged release manifest, or run `aapt dump permissions app-release.aab/apk`.
  - Unit-tested in `plugins/__tests__/withOffline.test.ts`.
- **OCR models ship inside the app.** Android depends on the bundled `com.google.mlkit:text-recognition` artifact (model in the APK), not the Play-Services variant that downloads models on first use. iOS bundles the model with the `GoogleMLKit/TextRecognition` pod.
- **No network code.** There are no analytics, crash reporters, OTA updates (`expo-updates` is not installed), remote fonts or remote images. Icons come from the bundled Ionicons font. Backups move only through the OS share sheet and document picker, at the user's request.
- **iOS** has no INTERNET permission to remove. The guarantee there rests on the code making no network calls, and the share extension only hands files to the app.

## Project structure

```
receipt-ledger/
├── app/                      # Expo Router routes
│   ├── _layout.tsx           # providers: share intent, DB, settings, theme, lock, toast
│   ├── +native-intent.tsx    # iOS share deep link → /import
│   ├── (tabs)/               # Home, Activity, Banks, Insights, Settings
│   ├── import.tsx            # share/gallery import queue
│   ├── transaction/new.tsx, transaction/[id].tsx
│   ├── bank/[id].tsx, bank/edit.tsx, account/edit.tsx
│   ├── categories.tsx, onboarding.tsx, receipt.tsx, debug.tsx
├── src/
│   ├── parser/               # pure TS receipt parser + bank profiles + fixtures/tests
│   ├── ocr/                  # downscale + ML Kit wrapper
│   ├── db/                   # driver abstraction, migrations, repositories, types
│   ├── domain/               # money (integer paisa), balances, duplicates, counterparty matching
│   ├── features/             # import, transactions, banks, backup, lock, share, toast, debug
│   ├── components/           # UI kit (buttons, fields, cards, charts, toast)
│   ├── theme/, i18n/, store/, hooks/, utils/
├── plugins/withOffline.js    # production INTERNET stripping
├── scripts/                  # verify-offline-manifest.js, gen-sample-texts.js
├── assets/samples/           # real sample receipts (dev builds only)
├── app.config.ts, eas.json
```

## Receipt parser

`parseReceipt(ocrText, ocrBlocks?, options?)` in `src/parser/index.ts` is pure and synchronous. It returns `{ amount, currency, date, counterparty, reference, bankHint, directionHint, confidence }`.

- **Normalization.** Fixes O→0, l/I/|→1 and S→5 only inside numeric tokens. Unifies `Rs`, `Rs.`, `RS`, `PKR` and `₨` to `Rs`. Collapses whitespace and unifies dashes and quotes.
- **Layout.** When ML Kit blocks carry geometry, visual rows are rebuilt, so two-column receipts read as "Label Value".
- **Amount.** Labeled amounts (Total Amount, Amount Sent/Transferred/Paid, You sent, credited with, …) score highest. A currency prefix, decimals and grouping add points. A label under the amount ("Successfully Sent to") also counts. Fees, charges, balances, IDs, account, phone and IBAN numbers, years, dates and times are excluded. Results are in integer **paisa**, computed by string arithmetic (never floats).
- **Date/time.** Handles `28 Oct 2026`, `28-10-2026`, `28/10/26`, `Oct 28, 2026 05:41 PM`, `2026-10-28 17:41:03`, `22-Oct-2026 at 4:10 PM` and a time on the next line. Numeric dates are day-first unless impossible. Times are interpreted as **Asia/Karachi**. Fallback order: the screenshot file's date, then now (low confidence, highlighted).
- **Counterparty.** Uses labels (To, Sent to, Paid to, Transferred To, Beneficiary, Account Title, Destination Acc. Title, Receiver, Merchant, Payee, From, Sender, Received from), sentence forms ("You sent Rs 500 to Ali"), names below a trailing "Sent to", and names above a vertically centered label. It strips IBANs, account and phone numbers, emails and handles, then title-cases. The side is chosen by direction (sent → payee, received → payer).
- **Direction hint.** Weighted phrases (You sent, Transferred to, Paid, Debited, Bill payment … vs Received from, Credited, You received, Credit alert).
- **Tests.** `src/parser/__tests__/parser.test.ts` covers 16 synthetic fixtures (all banks and wallets, OCR noise, SMS-style text, two-column layout) plus **12 real receipts** (Easypaisa, myABL, NayaPay) whose `.txt` files are genuine OCR output. On those 12 receipts the parser extracts every amount, counterparty, direction and printed date correctly. For references it returns exactly what OCR read; two hex transaction IDs contain OCR misreads (noted in `cases.ts`). It detects the bank on 11 of 12; myABL's logo was not read as text.

## Data model

SQLite, versioned through `PRAGMA user_version` (`src/db/migrations.ts`; v1 schema, v2 settings). Each migration runs in a transaction.

- `banks(id, name, color, icon, archived, created_at)`: `icon` holds the preset profile id.
- `accounts(id, bank_id, label, last4, currency, opening_balance_minor, archived, created_at)`
- `transactions(id, account_id, type['sent'|'received'], amount_minor CHECK > 0, occurred_at, counterparty, reference, category_id, note, receipt_path, source['share'|'gallery'|'manual'], created_at, updated_at)`
- `categories(id, name UNIQUE, color, icon)`, seeded with Food, Bills, Rent, Transport, Shopping, Family, Salary and Other.
- `counterparties(id, name, key UNIQUE, last_category_id, last_type, use_count)`
- `settings(key, value)`
- Indexes on `transactions(account_id, occurred_at)`, `reference` and `counterparty`.

Balances are **never stored**: `opening_balance_minor + Σreceived − Σsent` is computed in SQL, so edits and deletes always stay consistent. Receipt images are stored at `documentDirectory/receipts/<uuid>.jpg` as **relative** paths, which keeps backups portable.

## Decisions and defaults

- The app lives in `receipt-ledger/` so the repository's existing Python project is untouched.
- **Timezone:** times are stored as UTC instants and parsed and displayed as Asia/Karachi (fixed +05:00, no DST) for every user, regardless of device settings.
- **Fees:** when a receipt shows both "Amount" and "Total Amount", the labeled total wins (the money that actually left the account). Edit the amount if you track fees separately.
- **Multi-currency:** accounts can use PKR, USD, AED, SAR, GBP or EUR. Totals and insights are per currency (no FX conversion); Home shows the default currency's total plus a line per other currency.
- **Opening balance** may be negative (overdrawn) or zero.
- **App lock** re-locks after 30 s in the background; the import queue is kept while locked.
- **Sent / Received** buttons save immediately once an account is selected (fewest taps). Editing an existing transaction uses a type toggle plus Save.
- **Backups** are uncompressed zips (`backup.json` + `receipts/*`). Restore replaces all data after confirmation; paths are validated against traversal.
- **CSV** is UTF-8 with a BOM (opens in Excel), uses local date/time, and guards against formula injection.
- **Sample receipts** in `assets/samples/` are the real screenshots supplied for testing. They are `require`d only behind `__DEV__`, so Metro strips them from production bundles (checked with `expo export`).

## Verification status

| Check                                                             | Result                                                                                                                                                          |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit` (strict, typed routes)                             | clean                                                                                                                                                           |
| ESLint (expo config + React Compiler rules) + Prettier            | clean                                                                                                                                                           |
| Jest                                                              | 228 tests: parser (28 receipts), migrations, balances, duplicates, counterparty memory, backup round trip, CSV, account preselection, seed data, offline plugin |
| `APP_VARIANT=production expo prebuild -p android`                 | manifest has no INTERNET; `SEND` / `SEND_MULTIPLE` `image/*` filters present; dev variant keeps INTERNET                                                        |
| `expo export --platform android` (Hermes bundle)                  | builds; sample images excluded from production                                                                                                                  |
| Runtime smoke test (web build in headless Chromium, light + dark) | onboarding → seed → all tabs → import queue → save/undo → balances update; no console errors                                                                    |
| Native Gradle/Xcode build                                         | **not run in this environment**: the Android SDK and Maven repositories were unreachable from the build container. Build with EAS or `npx expo run:android`     |
| ML Kit on-device OCR                                              | not run here (needs a device). Parser accuracy on real receipts was measured with Tesseract OCR output as a stand-in                                            |

## Known limitations

- **ML Kit reads Latin script only.** Urdu text on receipts is not recognized. Names written in Urdu will not be extracted.
- OCR quality varies. Very blurry, cropped or low-contrast screenshots may need manual fixes; the form highlights uncertain fields.
- Easypaisa's "Successfully Sent to" screens contain **no date or reference**. The screenshot's file date is used and highlighted.
- Receipts that only show the bank as a logo (Easypaisa, sometimes myABL) depend on layout hints or keywords; the bank may be undetected. The account picker still remembers your last choice.
- "Transfer between my accounts" is not implemented. Record it as Sent on one account and Received on the other.
- iOS: the share extension relies on `expo-share-intent`; the iOS build was not tested in this environment.
- Web is not a supported target (it is used only for smoke testing). File storage, OCR and sharing are native-only.

## Suggested next steps

- Run the 12 sample receipts through ML Kit on a device (Debug tools) and add any differences as fixtures.
- Internal transfers (linked Sent/Received pair), recurring/bill reminders and budgets per category.
- Urdu UI (`src/i18n/ur.ts`) with RTL layout; an Urdu-capable OCR model if one becomes available on-device.
- Optional encrypted backups (passphrase), and automatic periodic backup to a user-chosen folder (SAF on Android).
- A Detox/Maestro end-to-end test of the share flow on an emulator in CI.
