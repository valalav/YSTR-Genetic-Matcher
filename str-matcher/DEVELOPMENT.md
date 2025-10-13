# Development Guide

Technical documentation for developers working on the YSTR Genetic Matcher project.

## Table of Contents
- [Project Structure](#project-structure)
- [Key Components](#key-components)
- [API Integration](#api-integration)
- [State Management](#state-management)
- [Haplogroup Filtering](#haplogroup-filtering)
- [Common Tasks](#common-tasks)
- [Debugging](#debugging)

## Project Structure

```
str-matcher/
├── src/
│   ├── app/                          # Next.js 15 App Router
│   │   ├── page.tsx                  # Home page (redirects to backend-search)
│   │   ├── backend-search/
│   │   │   └── page.tsx              # Main search interface
│   │   └── samples/
│   │       └── page.tsx              # Profile management page
│   │
│   ├── components/
│   │   ├── ui/                       # Shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── checkbox.tsx
│   │   │   └── ...
│   │   │
│   │   └── str-matcher/              # Domain components
│   │       ├── BackendSearch.tsx     # Main search component
│   │       ├── AdvancedMatchesTable.tsx
│   │       ├── STRMarkerGrid.tsx
│   │       ├── HaplogroupInfoPopup.jsx
│   │       ├── ProfileEditModal.tsx
│   │       └── SampleManager.tsx
│   │
│   ├── hooks/
│   │   └── useBackendAPI.ts          # PostgreSQL backend integration
│   │
│   ├── utils/
│   │   ├── axios.ts                  # API client configuration
│   │   ├── calculations.ts           # GD calculation & filtering
│   │   ├── constants.ts              # Marker definitions
│   │   └── mutation-rates.ts         # FTDNA mutation rate data
│   │
│   ├── types/
│   │   └── index.ts                  # TypeScript type definitions
│   │
│   └── config/
│       └── translations.ts           # i18n strings
│
├── public/                           # Static assets
├── next.config.js                    # Next.js configuration
├── tailwind.config.ts                # Tailwind CSS configuration
└── tsconfig.json                     # TypeScript configuration
```

## Key Components

### BackendSearch.tsx

Main search component that orchestrates the entire search workflow.

**State Variables:**
```typescript
const [kitNumber, setKitNumber] = useState('');
const [profile, setProfile] = useState<STRProfile | null>(null);
const [matches, setMatches] = useState<STRMatch[]>([]);
const [filteredMatches, setFilteredMatches] = useState<STRMatch[]>([]);
const [maxDistance, setMaxDistance] = useState(25);
const [maxResults, setMaxResults] = useState(150);
const [markerCount, setMarkerCount] = useState<12 | 25 | 37 | 67 | 111>(37);
const [selectedHaplogroup, setSelectedHaplogroup] = useState('');
const [includeSubclades, setIncludeSubclades] = useState(true);
const [isFilterActive, setIsFilterActive] = useState(false);
const [selectedHaplogroupInfo, setSelectedHaplogroupInfo] = useState<string | null>(null);
const [editingKitNumber, setEditingKitNumber] = useState<string | null>(null);
```

**Key Functions:**
- `handleSearchByKit()` - Search by kit number
- `handleSearchByMarkers()` - Search by custom markers
- `handleApplyFilter(haplogroupToFilter?)` - Apply haplogroup filter
- `handleHaplogroupClick(haplogroup)` - Quick filter by haplogroup
- `handleKitNumberClick(kitNumber)` - Search matches for clicked kit
- `handleRemoveMarker(marker)` - Remove marker and re-search

### AdvancedMatchesTable.tsx

Results table with advanced features.

**Props:**
```typescript
interface AdvancedMatchesTableProps {
  matches: STRMatch[];
  query: STRProfile | null;
  showOnlyDifferences?: boolean;
  onKitNumberClick?: (kitNumber: string) => void;
  onRemoveMarker?: (marker: string) => void;
  onHaplogroupClick?: (haplogroup: string) => void;
  onHaplogroupInfo?: (haplogroup: string) => void;
  onEditProfile?: (kitNumber: string) => void;
}
```

**Features:**
- Marker sorting by mutation rate or genetic distance
- Hide/unhide individual matches (localStorage persistence)
- Clickable kit numbers for new searches
- Clickable haplogroups for info and filtering
- Inline profile editing
- Marker difference highlighting

### HaplogroupInfoPopup.jsx

Modal for displaying haplogroup phylogenetic paths.

**API Call:**
```javascript
const response = await apiClient.get(`/haplogroup-path/${encodeURIComponent(haplogroup)}`);
// Returns: { ftdnaDetails: {...}, yfullDetails: {...} }
```

**Display:**
- FTDNA path with link to FTDNA website
- YFull path with link to YFull website
- Variant information
- Match confidence scores

### ProfileEditModal.tsx

Modal for editing profiles with API authentication.

**Workflow:**
1. Check sessionStorage for existing API key
2. If no key, show authentication form
3. After authentication, load SampleManager with initialKitNumber
4. User edits profile and saves

## API Integration

### PostgreSQL Backend Hook (useBackendAPI.ts)

```typescript
export const useBackendAPI = () => {
  const findMatches = async (params: SearchParams) => {
    const response = await axios.post(`${BACKEND_URL}/api/search`, params);
    return response.data.matches;
  };

  const getProfile = async (kitNumber: string) => {
    const response = await axios.get(`${BACKEND_URL}/api/samples/${kitNumber}`);
    return response.data.sample;
  };

  const getDatabaseStats = async () => {
    const response = await axios.get(`${BACKEND_URL}/api/database/statistics`);
    return response.data;
  };

  return { findMatches, getProfile, getDatabaseStats, loading, error };
};
```

### FTDNA Haplogroup API

**Batch Subclade Check:**
```typescript
// utils/calculations.ts - processMatches()
const batchPayload = {
  haplogroups: ['R-L21', 'R-U152', 'J-M172'],
  parentHaplogroups: ['R-M269']
};

const response = await axios.post('/api/batch-check-subclades', batchPayload);
// Returns: { results: { 'R-L21': true, 'R-U152': true, 'J-M172': false } }
```

**Haplogroup Path:**
```typescript
const response = await apiClient.get(`/haplogroup-path/${haplogroup}`);
// Returns: {
//   ftdnaDetails: {
//     path: { string: 'A > BT > CT > ... > R-M269' },
//     variants: [...],
//     url: 'https://discover.familytreedna.com/...'
//   },
//   yfullDetails: { ... }
// }
```

## State Management

### Search Flow

1. **Initial Search**:
   ```
   User input → handleSearchByKit/Markers → findMatches API
   → setMatches(results) → setFilteredMatches(results)
   ```

2. **Apply Filter**:
   ```
   User input → handleApplyFilter(haplogroup)
   → processMatches(matches, filters) → batch-check-subclades API
   → setFilteredMatches(filtered) → setIsFilterActive(true)
   ```

3. **Display**:
   ```
   displayedMatches = isFilterActive ? filteredMatches : matches
   ```

### Filter State Management

**Important**: `handleApplyFilter` accepts an optional parameter to avoid React state race conditions:

```typescript
const handleApplyFilter = useCallback(async (haplogroupToFilter?: string) => {
  const haplogroup = haplogroupToFilter || selectedHaplogroup;
  // Use haplogroup directly, not selectedHaplogroup
}, [selectedHaplogroup, includeSubclades, showEmptyHaplogroups, matches]);
```

**Usage:**
```typescript
// Direct call with parameter (avoids race condition)
handleApplyFilter('J-Z387');

// Call with state value
handleApplyFilter(); // uses selectedHaplogroup from closure
```

## Haplogroup Filtering

### Architecture

```
Frontend (BackendSearch)
    ↓
processMatches (calculations.ts)
    ↓
POST /api/batch-check-subclades (FTDNA server port 9003)
    ↓
HaplogroupService.batchCheckSubclades()
    ↓
FTDNA Tree traversal
    ↓
Return { results: Record<string, boolean> }
```

### Implementation Details

**ftdna_haplo/server/server.js** (line 249-345):
```javascript
app.post('/api/batch-check-subclades', async (req, res) => {
  const { haplogroups, parentHaplogroups } = req.body;

  // Use proper tree-based checking (NOT fallback)
  if (!haplogroupService) {
    // Fallback to string matching only if service unavailable
    return res.json({ results: fallbackResults });
  }

  // Proper tree-based checking
  const results = await haplogroupService.batchCheckSubclades(
    haplogroups,
    parentHaplogroups
  );

  res.json({ results });
});
```

**Critical Fix**: Line 268 must NOT have `|| true`:
```javascript
// WRONG (always uses fallback):
if (!haplogroupService || true) { ... }

// CORRECT (uses tree when available):
if (!haplogroupService) { ... }
```

## Common Tasks

### Adding a New Component

1. Create component in `src/components/str-matcher/`
2. Define TypeScript interfaces
3. Import in parent component
4. Add to component tree
5. Update documentation

### Adding a New API Endpoint

1. Define endpoint in backend service
2. Add function to `useBackendAPI.ts` or create new hook
3. Import and use in component
4. Add error handling
5. Update API documentation section

### Modifying Marker Panels

Edit `src/utils/constants.ts`:
```typescript
export const markerGroups = {
  12: ['DYS393', 'DYS390', ...],
  25: [...],
  // Add new panel
  200: [...]
};
```

Update type:
```typescript
type MarkerCount = 12 | 25 | 37 | 67 | 111 | 200;
```

### Adding Mutation Rate Data

Edit `src/utils/mutation-rates.ts`:
```typescript
export const mutationRates: Record<string, number> = {
  'DYS393': 0.00088,
  'DYS390': 0.00246,
  // Add new marker
  'DYS999': 0.00150,
};
```

## Debugging

### Enable API Logging

In `src/utils/axios.ts`, logging is automatic in development:
```typescript
if (process.env.NODE_ENV !== 'production') {
  console.log(`API Request: ${request.method} ${request.url}`);
}
```

### Check Backend Services

```bash
# PostgreSQL Backend
curl http://localhost:9004/api/database/statistics

# FTDNA Haplogroup Service
curl http://localhost:9003/api/haplogroup-path/R-M269

# Batch subclade check
curl -X POST http://localhost:9003/api/batch-check-subclades \
  -H "Content-Type: application/json" \
  -d '{"haplogroups":["R-L21"],"parentHaplogroups":["R-M269"]}'
```

### Common Issues

**FTDNA API 500 Errors:**
1. Check service is running: `netstat -ano | findstr :9003`
2. Verify line 268 in `ftdna_haplo/server/server.js`
3. Restart service after code changes

**Filter Not Working:**
1. Check `handleApplyFilter` receives correct haplogroup
2. Verify `includeSubclades` state
3. Check console for API errors
4. Verify FTDNA service is running

**Profile Edit Not Saving:**
1. Check API key in sessionStorage
2. Verify backend accepts POST to `/api/samples`
3. Check network tab for request/response
4. Verify `X-API-Key` header is set

### Browser DevTools

**React DevTools:**
- Inspect component state
- Check props flow
- Monitor re-renders

**Network Tab:**
- Monitor API calls
- Check request/response payloads
- Verify endpoints and status codes

**Console:**
- Check for API request logs
- Look for error messages
- Verify data transformations

## Testing

### Manual Testing Checklist

**Search:**
- [ ] Search by kit number works
- [ ] Search by markers works
- [ ] Results display correctly
- [ ] Pagination works (if implemented)

**Filtering:**
- [ ] Haplogroup filter applies correctly
- [ ] Include subclades works
- [ ] Quick filter button works
- [ ] Filter reset works

**Haplogroup Info:**
- [ ] Popup opens on haplogroup click
- [ ] FTDNA path displays
- [ ] YFull path displays
- [ ] Links work

**Profile Editing:**
- [ ] Edit button opens modal
- [ ] API key authentication works
- [ ] Profile loads correctly
- [ ] Changes save successfully

## Performance Optimization

### Lazy Loading
Components use dynamic imports where appropriate:
```typescript
const SampleManager = dynamic(() => import('@/components/str-matcher/SampleManager'));
```

### Memoization
Use `useMemo` and `useCallback` for expensive operations:
```typescript
const sortedMarkers = useMemo(() => {
  return getMarkersSortedByMutationRate(markers);
}, [markers]);
```

### API Optimization
- Batch subclade checks instead of individual requests
- Cache haplogroup results in `calculations.ts`
- Debounce search inputs (if needed)

## Contributing Guidelines

1. **Code Style**: Follow existing TypeScript/React patterns
2. **Commits**: Use conventional commits format
3. **Testing**: Test all changes manually
4. **Documentation**: Update this file with new features
5. **PR Process**: Submit PRs with clear descriptions

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
