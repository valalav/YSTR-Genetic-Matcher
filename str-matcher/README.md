# 🧬 YSTR Genetic Matcher

Advanced Y-STR genetic matching system with PostgreSQL backend, FTDNA haplogroup tree integration, and comprehensive profile management.

## Features

### 🔍 Search & Matching
- **Dual Search Modes**:
  - Search by Kit Number - Find matches for existing profiles
  - Search by Markers - Enter custom STR markers for matching
- **PostgreSQL Backend** - Fast, scalable database for 160,000+ profiles
- **Genetic Distance Calculation** - Accurate GD computation with marker-specific mutation rates
- **Configurable Panels** - Support for Y-STR12, 25, 37, 67, and 111 marker panels
- **Advanced Filtering** - Filter results by genetic distance and maximum results

### 🧬 Haplogroup Features
- **FTDNA Haplogroup Tree Integration** - Hierarchical subclade filtering using FTDNA's phylogenetic tree
- **Clickable Haplogroup Info** - View detailed haplogroup paths from FTDNA and YFull
- **Quick Filtering** - One-click filter by haplogroup with subclade support
- **Batch Subclade Checking** - Efficient API for checking multiple haplogroups at once

### 📊 Profile Management
- **Inline Profile Editing** - Edit profiles directly from search results
- **API Key Authentication** - Secure profile modifications
- **Bulk Import** - CSV import for multiple profiles
- **Hide/Show Matches** - Manage visibility of individual matches

### 🎯 Advanced Features
- **Marker Mutation Rates** - FTDNA-based mutation rates for accurate distance calculations
- **Marker Sorting** - Sort by mutation rate, genetic distance, or standard order
- **Difference Highlighting** - Visual highlighting of marker differences
- **Palindromic Marker Support** - Proper handling of DYS385, DYS459, etc.
- **Persistent Hidden Matches** - localStorage-based match hiding

## Architecture

### Components

```
str-matcher/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Main search page
│   │   ├── backend-search/             # PostgreSQL backend search
│   │   └── samples/                    # Profile management page
│   ├── components/
│   │   └── str-matcher/
│   │       ├── BackendSearch.tsx       # Main search component
│   │       ├── AdvancedMatchesTable.tsx # Results table with editing
│   │       ├── HaplogroupInfoPopup.jsx # Haplogroup details modal
│   │       ├── ProfileEditModal.tsx    # Profile editing modal
│   │       └── SampleManager.tsx       # Profile CRUD operations
│   ├── hooks/
│   │   └── useBackendAPI.ts            # PostgreSQL backend API hook
│   └── utils/
│       ├── calculations.ts             # GD calculation & haplogroup filtering
│       └── mutation-rates.ts           # FTDNA mutation rate data
```

### Services

#### PostgreSQL Backend (Port 9004)
- Profile storage and retrieval
- Fast genetic distance search
- Profile CRUD operations
- Statistics and analytics

#### FTDNA Haplogroup Service (Port 9003)
- Haplogroup tree navigation
- Subclade checking
- Batch haplogroup validation
- FTDNA and YFull path resolution

#### Next.js Frontend (Port 3002)
- User interface
- API proxy to backend services
- Real-time search and filtering

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- 160,000+ YSTR profiles loaded in database

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DNA-utils-universal/str-matcher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   # .env.local
   NEXT_PUBLIC_API_URL=/api
   HAPLO_API_URL=http://localhost:9003
   ```

4. **Start the backend services**
   ```bash
   # Terminal 1: PostgreSQL backend (port 9004)
   cd ../postgres_backend
   node server.js

   # Terminal 2: FTDNA Haplogroup service (port 9003)
   cd ../ftdna_haplo/server
   node server.js
   ```

5. **Start the development server**
   ```bash
   # Terminal 3: Next.js frontend (port 3002)
   PORT=3002 npm run dev
   ```

6. **Open the application**
   ```
   http://localhost:3002/backend-search
   ```

## Usage

### Searching for Matches

#### By Kit Number
1. Select "🎯 Search by Kit Number"
2. Enter a kit number (e.g., "55520")
3. Choose marker panel (12, 25, 37, 67, or 111)
4. Set max genetic distance and max results
5. Click "🔍 Search for Matches"

#### By Markers
1. Select "🧬 Search by Markers"
2. Enter STR marker values in the grid
3. Configure search parameters
4. Click "🧬 Search by Markers"

### Filtering by Haplogroup

#### Method 1: Filter Input
1. Enter haplogroup in "Haplogroup Filter" field (e.g., "J-Z387")
2. Toggle "Include subclades" if needed
3. Click "Apply Filter"

#### Method 2: Quick Filter Button
1. Click the "1" button next to any haplogroup in results
2. Filter applies immediately with subclade support

### Viewing Haplogroup Info
1. Click on any haplogroup name in the results table
2. View detailed FTDNA and YFull paths
3. Click links to open in FTDNA/YFull websites

### Editing Profiles
1. Click the pencil (✏️) icon next to any kit number
2. Enter API key if not authenticated
3. Edit markers, haplogroup, name, or country
4. Save changes

## API Endpoints

### PostgreSQL Backend (Port 9004)

```
GET  /api/samples/:kitNumber        # Get profile by kit number
POST /api/samples                   # Create/update profile
GET  /api/database/statistics       # Get database stats
POST /api/search                    # Search for matches
```

### FTDNA Haplogroup Service (Port 9003)

```
GET  /api/haplogroup-path/:haplogroup         # Get haplogroup path
POST /api/batch-check-subclades               # Check multiple subclades
POST /api/haplogroup-search                   # Search haplogroups
```

## Configuration

### Marker Panels
- **Y-STR12**: DYS393, DYS390, DYS19, DYS391, DYS385a, DYS385b, DYS426, DYS388, DYS439, DYS389I, DYS392, DYS389II
- **Y-STR25**: 12 + 13 additional markers
- **Y-STR37**: 25 + 12 additional markers
- **Y-STR67**: 37 + 30 additional markers
- **Y-STR111**: 67 + 44 additional markers

### Search Parameters
- **Max Genetic Distance**: 0-50 (default: 25)
- **Max Results**: 1-1000 (default: 150)
- **Include Subclades**: true/false (default: true)
- **Show Empty Haplogroups**: true/false (default: false)

## Recent Updates

### Version 2.0 (Latest)
- ✅ Fixed FTDNA haplogroup tree filtering (removed `|| true` fallback)
- ✅ Added clickable haplogroup info popups with FTDNA/YFull paths
- ✅ Implemented inline profile editing from matches table
- ✅ Added quick filter button (numbered "1") next to haplogroups
- ✅ Fixed emoji encoding issues in UI
- ✅ Limited Search Configuration width for better UX
- ✅ Implemented proper batch subclade checking API
- ✅ Fixed race condition in haplogroup filter application
- ✅ Added Russian localization for haplogroup popup

## Troubleshooting

### FTDNA API Returns 500 Errors
- Ensure FTDNA Haplogroup service is running on port 9003
- Check that `ftdna_haplo/server/server.js` line 268 doesn't have `|| true`
- Restart the FTDNA service after code changes

### Search Returns No Results
- Verify PostgreSQL backend is running on port 9004
- Check database has profiles loaded
- Ensure marker panel matches available data

### Profile Edit Not Working
- Enter valid API key when prompted
- Check PostgreSQL backend is accepting writes
- Verify API key header is set correctly

## Technologies Used

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend**: PostgreSQL 14, Express.js, Node.js
- **APIs**: FTDNA Haplogroup Tree, Axios, Papa Parse (CSV)
- **UI Components**: Radix UI, Shadcn/ui
- **State Management**: React Hooks

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]

## Credits

- FTDNA mutation rate data
- YFull haplogroup tree data
- Community contributions

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
