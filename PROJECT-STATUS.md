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
- np-smart-scanner.js

Other project files:

- smart-search.js
- location-search.js
- emergency-location.js
- district_skeleton.json

## Smart Document & Contact Scanner

- Work branch: `feature/smart-document-contact-assistant`
- User-requested scope on 2026-11-02: keep only Camera and Gallery for general text/contact OCR; remove QR/Barcode decoding, payment QR handling, and ID-card classification/number extraction.
- The existing scanner entry point and modal remain. The modal presents only Camera and Gallery. Camera requests the rear camera first, shows a scan frame, and has automatic stable-frame capture plus manual Capture. Gallery selects one image and processes it with OCR only.
- Contact-like images can show explicitly labelled name/company/email where found and deduplicated phone numbers. No ID-card type or ID number is recognised or presented.
- OCR is lazy-loaded and runs in a browser worker using English data; Tesseract cache is disabled.
- Scan images/results are temporary in-memory values; clear, close, Back, and page exit trigger cleanup.
- Contact export uses a user-edited vCard/share flow; saving in Contacts requires the user's confirmation.
- Previous local checks on 2026-11-01 confirmed contact-card OCR and phone parsing; ID and QR/Barcode checks from that version no longer apply after the requested removal.
- Static checks on 2026-11-02: JavaScript syntax passed; scanner modal has exactly two options; HTML IDs are unique; QR/Barcode decoder, UPI handling, and ID-card classification code/dependencies are absent. Gallery OCR and camera capture were not browser-tested again after this scope change.
- Camera selection was attempted with user approval, but that browser session could not access a camera device. Live camera preview, automatic/manual capture, physical Android compatibility, contact share/download, and deployment behavior remain unverified.
- The Vercel Test deployment commit SHA was not available from the public page during audit.

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
