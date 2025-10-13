$file = "str-matcher/src/components/str-matcher/BackendSearch.tsx"
$content = Get-Content $file -Raw

# 1. Add import
$content = $content -replace "(import STRMarkerGrid from '\./STRMarkerGrid';)", "`$1`nimport HaplogroupSelector from './HaplogroupSelector';"

# 2. Add state
$content = $content -replace "(const \[searchMode, setSearchMode\] = useState<'kit' \| 'markers'>.*?;)", "`$1`n  const [selectedHaplogroup, setSelectedHaplogroup] = useState('');"

# 3. Update first findMatches
$content = $content -replace "(markers: foundProfile\.markers,\s+maxDistance,\s+limit: maxResults,)", "`$1`n        haplogroupFilter: selectedHaplogroup || undefined,"

# 4. Update second findMatches
$content = $content -replace "(markers: markersToSearch,\s+maxDistance,\s+limit: maxResults,)", "`$1`n        haplogroupFilter: selectedHaplogroup || undefined,"

# 5. Add component after maxResults div (before closing </div> of grid)
$searchSettingsEnd = $content.IndexOf("</div>`n`n            {searchMode")
if ($searchSettingsEnd -gt 0) {
    $before = $content.Substring(0, $searchSettingsEnd)
    $after = $content.Substring($searchSettingsEnd)
    $component = "`n`n            {/* Haplogroup Selector */}`n            <HaplogroupSelector`n              selectedHaplogroup={selectedHaplogroup}`n              onHaplogroupChange={setSelectedHaplogroup}`n              minProfiles={500}`n            />`n"
    $content = $before + $component + $after
}

$content | Out-File -FilePath $file -Encoding utf8 -NoNewline
Write-Host "Patch applied successfully"
