# BioShelf (React Native) — Healthcare Asset & Expiry Tracker

React Native + Expo (SDK 58, TypeScript) port of the Flutter BioShelf app in `../bioshelf`.
Same features and premium glass design (Midnight Champagne / Porcelain themes).

## Run on your phone

```bash
cd CIE3/bioshelf-rn
npm install
npx expo start            # scan the QR code with the Expo Go app
```

Label auto-reading (OCR) uses a native module that Expo Go doesn't include. For it, build the app:

```bash
npx expo run:android      # phone connected by USB with USB debugging on
```

Browser: `npx expo start --web`.

## Features

- Dashboard: shelf-health ring, expired / critical / expiring / low-stock tiles, expiring-next carousel, 6-month outlook, categories, activity.
- Inventory: search, category and status filters with counts, 5 sort orders, undo / redo.
- Asset detail: countdown ring, stock use / restock, info grid, audit trail, dispose.
- Add / edit with **label photo**: take or upload a photo; name, batch, dates, maker, quantity, storage and category are read automatically (ML Kit / Apple Vision on phones, Tesseract.js in the browser) and fill empty fields, marked with ✦ and undoable.
- Alerts action centre, settings (theme, alert sensitivity, CSV export, sample data).

Storage: SQLite + photo files on phones; localStorage in the browser.

## Architecture & patterns

`src/domain` (pure TS) → `src/data` → `src/presentation` (+ `src/app` routes).
MVVM, Repository, Data Mapper, Strategy, Decorator, Factory, Specification, Command (undo/redo),
Chain of Responsibility (label parser), Adapter (OCR engines), Observer, Singleton (service locator).

## Checks

```bash
npm run typecheck && npm run lint && npm test   # 45 tests
```