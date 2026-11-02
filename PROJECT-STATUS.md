# নাগরিক পরিষেবা — Project Status

Website: Online পরিষেবা — আপনার পাশে, আপনার সাথে

## Websites

Production:
https://wbseba.vercel.app

Test:
https://test-wbseba.vercel.app

## Current Versions

Production: 2.3 LIVE

Test: 2.5 Development

## GitHub Repositories

Production:
https://github.com/infomtek/wbseba

Test:
https://github.com/infomtek/Test-wbseba

## Backup

Branch:
backup-before-search-2.4-cleanup

## Current Working Features

- 50 Service Cards detected
- Unified Search Engine
- Smart Suggestions
- Bengali and English Bank Search
- Bank Modal Live Filtering
- Blue Search Arrow Button
- Keyboard Enter Search
- Voice Search (Chrome/Edge)
- Emergency Search
- GPS and Nearby Search
- District Directory
- Cyber Safety Features
- Floating Action Buttons
- Google Sheets Dynamic Service Cards

## Current JavaScript Files

- unified-search.js
- np-ux-upgrade.js
- np-bank-search.js

Other project files:

- smart-search.js
- location-search.js
- emergency-location.js
- district_skeleton.json

## Scanner Feature Status

- Removed from the WBSEBA web app on 2026-11-02 at the user's request. Camera/Gallery scanning, QR/Barcode decoding, ID-card recognition, the scanner modal/home entry point, and the scanner JavaScript/CSS integration are not included.
- The user plans to build a separate small application for scanning codes and ID cards. That separate application is outside this WBSEBA website change.
- Static checks on 2026-11-02: scanner modal, launcher, library dependency, JavaScript file, styles, and modal close hooks are absent; 129 HTML IDs are unique; relevant JavaScript syntax and diff checks passed. Existing unrelated cyber-safety scan service and government QR verification link remain. No browser UI test was run for this removal.
- No browser deployment or production change was performed.

## Known Search Problems

1. Typed and Voice Search sometimes give different results.
2. Land Records typed search may not open the existing service.
3. Multilingual aliases are incomplete.
4. Some Bengali voice spelling errors are not recognized.
5. All 50 service cards need indexing.
6. Search suggestion selection needs reliable service actions.
7. Search clear should restore homepage content.
8. Google Sheets services need dynamic search indexing.
9. Duplicate listeners and dropdown conflicts need continued testing.

## Planned Search Upgrade

Unified Smart Search 2.4

- Bengali + English + Mixed Language
- Partial Word Matching
- Typo Matching
- Voice Spelling Correction
- Dynamic Google Sheets Index
- Existing Service Card and Modal Actions
- Government Services First
- Smart Suggestions Dropdown
- Search Arrow and Enter
- Homepage Restore on Clear

## Safety Rules

- Never modify Production directly.
- Test changes before Production release.
- Preserve all existing service cards.
- Preserve working modals and links.
- Preserve Voice, GPS and Emergency systems.
- Never invent government URLs or emergency contacts.
- Never expose API keys or credentials.
- Keep backup branch unchanged.
- Make one safe change at a time.

## Next Task

Create a dynamic multilingual service search index
using existing website service cards and Google Sheets.

Do not delete existing search files yet.
