# PSAR POD Field Assistant Change Log

This document captures the current implementation prompts and follow-up fixes for the PSAR POD Field Assistant.

## Active implementation items

1. **Duplicate segment**
   - Add a Duplicate action for segments.
   - Duplicated segments copy all segment values, including notes.
   - Duplicates are treated as brand-new segments.
   - Duplicates reset to `Unnamed`, `Not uploaded`, and receive new unique IDs / creation metadata.

2. **Upload status / changed since upload**
   - Add segment upload states:
     - Not uploaded
     - Uploaded
     - Updated since upload
     - Upload failed
   - Any user edit in the segment section after upload marks the segment as updated since upload.
   - Works for both Upload All and segment-by-segment upload.

3. **Default unnamed segments**
   - New segments should default to `Unnamed`.
   - Unnamed segments are still allowed to upload.
   - Sequential default naming should be removed.

4. **Offline reassurance and status repositioning**
   - Keep the online / offline / ready indicator.
   - Move it to just above the white search details box.
   - Add a small offline reassurance message when offline, such as:
     - No signal detected
     - Your inputs are safe and can be uploaded when connection returns

5. **Tooltip and help text improvements**
   - Improve Extenuating Factors help content.
   - Add searcher fatigue.
   - Make key examples easier to scan.
   - Add weather guidance limited to extreme conditions.

6. **Wilderness / Urban selector**
   - Add a selector above Search for.
   - Options:
     - Wilderness
     - Urban
   - Default to Wilderness.
   - Show Urban as visible but disabled.
   - Do not include this selector in uploads, desktop integration, or report output at this time.

7. **About This Tool**
   - Add an About This Tool button in the banner/header area.
   - Keep content short and bullet-based.
   - Explain that the tool is a field aid to support consistent POD assessment and structured reporting back to command.

8. **Rename branding**
   - Update user-facing naming to:
     - **PSAR POD Field Assistant**
   - Apply to visible branding/title areas and PWA display fields where appropriate.

9. **Duplicate button visibility bug fix**
   - Make the Duplicate button always visible.
   - Keep its current location if it already fits.
   - Style it as a normal visible button rather than hover-only.

## Follow-up corrective prompts

### Remove upload status from the main page
- Upload status should only appear in the View Report section.
- Remove it from the main / landing page segment editing area.
- Keep the underlying upload state logic intact.

### Unnamed default bug fix
- The `Unnamed` default is not currently working correctly.
- It should appear:
  - in the segment list
  - in the segment survey / segment form section
  - as actual default typed-in text in the segment name field
- The current old sequential logic is still being used and should be removed.
- New segments should display `Unnamed` immediately and consistently anywhere the segment name appears unless the user changes it.
- Duplicated segments should also display `Unnamed` immediately unless renamed by the user.

## Tabled for later

- Micro-terrain visual aid improvements
- Copy / import segment setup by QR or text
- Camera / photo-based classification
- Optional photo attachment / documentation
- Team lead view
- Expanded time-of-day guidance
- Idea / bug report submission workflow

## Suggested implementation order

1. Duplicate segment
2. Default unnamed segments
3. Upload status / changed since upload
4. Remove upload status from main page
5. Offline reassurance and status repositioning
6. Tooltip and weather guidance improvements
7. Wilderness / Urban selector
8. About This Tool
9. Rename branding to PSAR POD Field Assistant
10. Duplicate button visibility bug fix
11. Unnamed default bug fix
