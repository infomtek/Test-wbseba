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

## Cyber Scam Link Checker

- The link checker now returns three cautious outcomes: known/recognized (green), caution or unknown (amber), and high-risk signals (red).
- The exact WBSEBA hosts `wbseba.vercel.app` and `test-wbseba.vercel.app` are on the known-host list. Government/bank suffix checks use the parsed hostname boundary rather than matching text anywhere in the URL.
- Red warnings cover non-encrypted HTTP, embedded credentials, direct IP hosts, and trusted-name lookalikes that do not match a recognized host. A red warning is a risk signal, not proof of fraud; lookalike matching may produce false positives.
- Shortened and punycode hosts receive an amber caution. Other unrecognized links remain unknown/amber and are not described as safe.
- A server-side Google Web Risk Lookup endpoint checks malware, social engineering, and unwanted-software lists. ChatGPT/Gemini is not used to guess whether a URL is safe.
- When a user presses the check button, the normalized URL is sent to this site's `/api/check-url` endpoint and then to Google Web Risk. The API key remains server-side; this code does not log or persist submitted URLs. The checker explains this before the user submits a link.
- Deployment requires the Google Cloud Web Risk API to be enabled and `WEBRISK_API_KEY` configured in the Vercel Test environment. Until configured, the live check returns unavailable and the page falls back to local risk signals; it does not claim a clean Web Risk result.
- Google threat matches produce a qualified red warning with Google attribution. A no-match response is not presented as proof that the website is safe. Screenshot upload still is not analyzed and the UI says so.
- Local checks on 2026-11-02: 13 URL-classification cases and 6 mocked API-handler cases passed; the changed inline JavaScript syntax passed; all 129 HTML IDs remain unique; whitespace checks passed. A live Google lookup and full browser/deployed-site test remain pending because no Web Risk key is configured in this workspace.
- Changes are on the existing Test feature branch in local commit `3754db9`. Push and preview deployment were attempted but not completed because GitHub credentials are unavailable to this session and the Vercel CLI/project link is absent from this checkout. Production was not touched.

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
