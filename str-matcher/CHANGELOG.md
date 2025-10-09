# Changelog

All notable changes to the YSTR Genetic Matcher project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-09

### Added
- **Haplogroup Info Popup**: Click on haplogroup names to view detailed FTDNA and YFull paths
  - Shows complete phylogenetic path from root to haplogroup
  - Direct links to FTDNA and YFull websites
  - Russian localization ("Гаплогруппа", "Путь FTDNA", "Путь YFull")

- **Inline Profile Editing**: Edit profiles directly from matches table
  - Pencil icon (✏️) next to kit numbers
  - API key authentication modal
  - Opens SampleManager with pre-loaded profile data
  - Full CRUD operations for markers, haplogroup, name, and country

- **Quick Haplogroup Filter**: One-click filtering with numbered "1" button
  - Button appears next to each haplogroup in results
  - Automatically applies filter with subclade support
  - Syncs with main filter input

- **ProfileEditModal Component**: New modal for profile editing workflow
  - API key authentication flow
  - Integration with SampleManager
  - Auto-loads profile based on kit number

- **SampleManager Enhancement**:
  - Added `initialKitNumber` prop for auto-loading profiles
  - useEffect hook to fetch profile on mount
  - Automatic mode switching to 'edit' when initialKitNumber provided

### Fixed
- **FTDNA Haplogroup Tree Filtering**:
  - Removed `|| true` condition in `ftdna_haplo/server/server.js:268`
  - Now properly uses phylogenetic tree instead of fallback string matching
  - Batch subclade checking API works correctly

- **Haplogroup Filter Race Condition**:
  - Changed `handleApplyFilter` to accept haplogroup parameter directly
  - Fixed bug where filter used old state value
  - Filter now applies to entered value instead of stale state

- **Emoji Encoding Issues**:
  - Fixed broken emoji display (рџ§¬ → 🧬, рџ"Ќ → 🔍)
  - Updated all emoji characters to proper UTF-8 encoding
  - Improved visual consistency across UI

- **HaplogroupInfoPopup Bug**:
  - Fixed `setPathInfo` undefined error
  - Changed to use `setResult` for storing API response
  - Proper error handling for missing haplogroup data

- **apiClient Import Error**:
  - Changed from default import to named import `{ apiClient }`
  - Fixes TypeError: Cannot read properties of undefined

### Changed
- **Search Configuration Layout**:
  - Changed from full-width grid to fixed-width flex layout
  - Marker panel fields: 200px width
  - Kit number input and buttons: max 400px width
  - Prevents form from stretching across entire page

- **AdvancedMatchesTable Enhancement**:
  - Added `onHaplogroupInfo` and `onEditProfile` props
  - Haplogroup cells now show clickable link + filter button
  - Kit number cells show clickable link + edit button
  - Improved flex layout for better button positioning

- **BackendSearch Refactoring**:
  - Moved `handleApplyFilter` before `handleHaplogroupClick` (function ordering fix)
  - Added state for `selectedHaplogroupInfo` and `editingKitNumber`
  - Integrated HaplogroupInfoPopup and ProfileEditModal components

### Technical Improvements
- **Function Ordering**: Fixed React hooks initialization order to prevent reference errors
- **State Management**: Added new state variables for modal management
- **Component Integration**: Better separation of concerns with dedicated modal components
- **API Communication**: Improved error handling in haplogroup API calls

## [1.0.0] - Previous Version

### Features
- PostgreSQL backend integration for 160,000+ profiles
- Dual search modes (Kit Number and Markers)
- Genetic distance calculation with FTDNA mutation rates
- Marker panels: Y-STR12, 25, 37, 67, 111
- Advanced matches table with sorting and filtering
- Hide/show matches functionality
- Marker difference highlighting
- Palindromic marker support (DYS385, DYS459, etc.)
- Database statistics display
- Sample management with CSV import
- API key authentication for profile modifications

---

## Release Notes Format

### Added
For new features.

### Changed
For changes in existing functionality.

### Deprecated
For soon-to-be removed features.

### Removed
For now removed features.

### Fixed
For any bug fixes.

### Security
In case of vulnerabilities.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
