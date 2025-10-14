"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Papa from 'papaparse';
import { dbManager } from '@/utils/storage/indexedDB';
import type { STRProfile } from '@/utils/constants';

interface Sample {
  markerCount?: number;
  kitNumber: string;
  name: string;
  country: string;
  haplogroup: string;
  markers: Record<string, string>;
}

interface SampleManagerProps {
  apiKey: string;
  backendUrl?: string;
  initialKitNumber?: string;
  onUpdate?: () => void;
  onDelete?: () => void;
}

const COMMON_STR_MARKERS = [
  'DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385', 'DYS426', 'DYS388', 'DYS439',
  'DYS389i', 'DYS392', 'DYS389ii', 'DYS458', 'DYS459', 'DYS455', 'DYS454', 'DYS447',
  'DYS437', 'DYS448', 'DYS449', 'DYS464', 'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456',
  'DYS607', 'DYS576', 'DYS570', 'CDY', 'DYS442', 'DYS438', 'DYS531', 'DYS578',
  'DYF395S1', 'DYS590', 'DYS537', 'DYS641', 'DYS472', 'DYF406S1', 'DYS511', 'DYS425',
  'DYS413', 'DYS557', 'DYS594', 'DYS436', 'DYS490', 'DYS534', 'DYS450', 'DYS444',
  'DYS481', 'DYS520', 'DYS446', 'DYS617', 'DYS568', 'DYS487', 'DYS572', 'DYS640',
  'DYS492', 'DYS565', 'DYS710', 'DYS485', 'DYS632', 'DYS495', 'DYS540', 'DYS714',
  'DYS716', 'DYS717', 'DYS505', 'DYS556', 'DYS549', 'DYS589', 'DYS522', 'DYS494',
  'DYS533', 'DYS636', 'DYS575', 'DYS638', 'DYS462', 'DYS452', 'DYS445', 'Y-GATA-A10',
  'DYS463', 'DYS441', 'Y-GGAAT-1B07', 'DYS525', 'DYS712', 'DYS593', 'DYS650', 'DYS532',
  'DYS715', 'DYS504', 'DYS513', 'DYS561', 'DYS552', 'DYS726', 'DYS635', 'DYS587',
  'DYS643', 'DYS497', 'DYS510', 'DYS434', 'DYS461', 'DYS435'
];

const SampleManager: React.FC<SampleManagerProps> = ({
  apiKey,
  backendUrl = process.env.NEXT_PUBLIC_API_URL || '/api',
  initialKitNumber,
  onUpdate,
  onDelete
}) => {
  const [mode, setMode] = useState<'add' | 'edit' | 'bulk' | 'search'>(initialKitNumber ? 'edit' : 'add');
  const [sample, setSample] = useState<Sample>({
    kitNumber: '',
    name: '',
    country: '',
    haplogroup: '',
    markers: {}
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [clipboardText, setClipboardText] = useState('');
  const [parsedSamples, setParsedSamples] = useState<Sample[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // Search state
  const [searchFilters, setSearchFilters] = useState({
    search: '',
    name: '',
    country: '',
    haplogroup: '',
    limit: 50,
    offset: 0
  });
  const [searchResults, setSearchResults] = useState<{ samples: Sample[], pagination: any } | null>(null);
  const [searching, setSearching] = useState(false);


  // Fetch sample for editing
  const fetchSample = useCallback(async (kitNumber: string) => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${backendUrl}/samples/${kitNumber}`);

      if (!response.ok) {
        throw new Error('Sample not found');
      }

      const data = await response.json();
      setSample({
        kitNumber: data.sample.kitNumber,
        name: data.sample.name || '',
        country: data.sample.country || '',
        haplogroup: data.sample.haplogroup || '',
        markers: data.sample.markers || {}
      });

      setMessage({ type: 'success', text: `Sample ${kitNumber} loaded successfully` });
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to load sample: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  // Search samples
  const searchSamples = useCallback(async (resetOffset = false) => {
    setSearching(true);
    setMessage(null);

    const filters = resetOffset ? { ...searchFilters, offset: 0 } : searchFilters;
    if (resetOffset) {
      setSearchFilters(filters);
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.name) params.append('name', filters.name);
      if (filters.country) params.append('country', filters.country);
      if (filters.haplogroup) params.append('haplogroup', filters.haplogroup);
      params.append('limit', filters.limit.toString());
      params.append('offset', filters.offset.toString());

      const response = await fetch(`${backendUrl}/samples/?${params}`);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data);
      setMessage({ type: 'success', text: `Found ${data.pagination.total} samples` });
    } catch (error) {
      setMessage({ type: 'error', text: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  }, [backendUrl, searchFilters]);


  // Auto-load sample if initialKitNumber is provided
  useEffect(() => {
    if (initialKitNumber) {
      fetchSample(initialKitNumber);
    }
  }, [initialKitNumber, fetchSample]);

  // Save sample (create or update)
  const saveSample = useCallback(async () => {
    if (!sample.kitNumber.trim()) {
      setMessage({ type: 'error', text: 'Kit Number is required' });
      return;
    }

    if (Object.keys(sample.markers).length === 0) {
      setMessage({ type: 'error', text: 'At least one marker is required' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${backendUrl}/samples`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify(sample)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to save sample');
      }

      const data = await response.json();
      setMessage({ type: 'success', text: `Sample ${sample.kitNumber} ${data.action} successfully` });

      // Refresh entire IndexedDB from PostgreSQL to ensure sync
      try {
        await dbManager.init();
        const refreshResponse = await fetch(`${backendUrl}/samples`);
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          const profiles: STRProfile[] = refreshData.samples || [];
          await dbManager.clearProfiles();
          await dbManager.saveProfiles(profiles);
          console.log(`✅ IndexedDB refreshed with ${profiles.length} profiles after save`);
        }
      } catch (dbError) {
        console.error('Failed to refresh IndexedDB:', dbError);
        // Don't throw - the backend update was successful
      }

      // Call onUpdate callback to refresh parent component
      onUpdate?.();

      // Clear form if adding new sample
      if (mode === 'add') {
        setSample({
          kitNumber: '',
          name: '',
          country: '',
          haplogroup: '',
          markers: {}
        });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setLoading(false);
    }
  }, [sample, apiKey, backendUrl, mode, onUpdate]);

  // Delete sample
  const deleteSample = useCallback(async () => {
    if (!sample.kitNumber.trim()) {
      setMessage({ type: 'error', text: 'No sample to delete' });
      return;
    }

    if (!confirm(`Are you sure you want to delete sample ${sample.kitNumber}? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${backendUrl}/samples/${sample.kitNumber}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to delete sample');
      }

      const kitNumberToDelete = sample.kitNumber; // Save before clearing
      setMessage({ type: 'success', text: `Sample ${kitNumberToDelete} deleted successfully` });

      // Refresh entire IndexedDB from PostgreSQL to ensure sync
      try {
        await dbManager.init();
        const refreshResponse = await fetch(`${backendUrl}/samples`);
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          const profiles: STRProfile[] = refreshData.samples || [];
          await dbManager.clearProfiles();
          await dbManager.saveProfiles(profiles);
          console.log(`✅ IndexedDB refreshed with ${profiles.length} profiles after delete`);
        }
      } catch (dbError) {
        console.error('Failed to refresh IndexedDB:', dbError);
        // Don't throw - the backend deletion was successful
      }

      // Call onDelete callback to refresh parent component
      onDelete?.();

      // Clear form
      setSample({
        kitNumber: '',
        name: '',
        country: '',
        haplogroup: '',
        markers: {}
      });
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setLoading(false);
    }
  }, [sample.kitNumber, apiKey, backendUrl, onDelete]);

  // Parse clipboard data
  const parseClipboardData = useCallback(() => {
    if (!clipboardText.trim()) {
      setMessage({ type: 'error', text: 'Please paste data first' });
      return;
    }

    try {
      // Try to parse as CSV
      const parsed = Papa.parse(clipboardText.trim(), {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim()
      });

      if (parsed.errors.length > 0) {
        console.warn('CSV parsing warnings:', parsed.errors);
      }

      const samples: Sample[] = [];

      parsed.data.forEach((row: any) => {
        // Extract kit number
        const kitNumber = row.kitNumber || row.kit_number || row.KitNumber || row['Kit Number'] || row.kitno;

        if (!kitNumber) {
          return; // Skip rows without kit number
        }

        // Extract basic info
        const name = row.name || row.Name || row.fullname || row['Full Name'] || '';
        const country = row.country || row.Country || row.location || row.Location || '';
        const haplogroup = row.haplogroup || row.Haplogroup || row['FTDNA HG'] || row.Yfull || '';

        // Extract markers
        const markers: Record<string, string> = {};
        Object.keys(row).forEach(key => {
          const upperKey = key.toUpperCase();
          if (upperKey.startsWith('DYS') || upperKey.startsWith('Y-') || upperKey.startsWith('CDY') || upperKey.startsWith('YCAII') || upperKey.startsWith('DYF')) {
            const value = row[key]?.toString().trim();
            if (value && value !== '' && value !== '0' && value !== '-') {
              markers[key] = value;
            }
          }
        });

        if (Object.keys(markers).length > 0) {
          samples.push({
            kitNumber,
            name,
            country,
            haplogroup,
            markers
          });
        }
      });

      setParsedSamples(samples);
      setMessage({ type: 'success', text: `Parsed ${samples.length} samples successfully` });
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to parse: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  }, [clipboardText]);

  // Upload parsed samples
  const uploadParsedSamples = useCallback(async () => {
    if (parsedSamples.length === 0) {
      setMessage({ type: 'error', text: 'No samples to upload' });
      return;
    }

    setLoading(true);
    setMessage(null);

    let successCount = 0;
    let errorCount = 0;

    for (const sample of parsedSamples) {
      try {
        const response = await fetch(`${backendUrl}/samples`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          },
          body: JSON.stringify(sample)
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    setLoading(false);
    setMessage({
      type: errorCount === 0 ? 'success' : 'error',
      text: `Uploaded: ${successCount} success, ${errorCount} failed`
    });

    if (successCount > 0) {
      setParsedSamples([]);
      setClipboardText('');
    }
  }, [parsedSamples, apiKey, backendUrl]);

  // Refresh IndexedDB from PostgreSQL
  const refreshDatabase = useCallback(async () => {
    setRefreshing(true);
    setMessage(null);

    try {
      // Fetch all profiles from backend
      const response = await fetch(`${backendUrl}/samples`);

      if (!response.ok) {
        throw new Error('Failed to fetch profiles from backend');
      }

      const data = await response.json();
      const profiles: STRProfile[] = data.samples || [];

      // Clear and repopulate IndexedDB
      await dbManager.init();
      await dbManager.clearProfiles();
      await dbManager.saveProfiles(profiles);

      setMessage({
        type: 'success',
        text: `Database refreshed successfully. Loaded ${profiles.length} profiles from server.`
      });

      console.log(`✅ IndexedDB refreshed with ${profiles.length} profiles from PostgreSQL`);

      // Call onUpdate to refresh any parent components
      onUpdate?.();
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Failed to refresh database: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      console.error('❌ Database refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [backendUrl, onUpdate]);

  // Handle CSV file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setClipboardText(text);
    };
    reader.readAsText(file);
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sample Manager</CardTitle>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Button
              variant={mode === 'add' ? 'default' : 'outline'}
              onClick={() => setMode('add')}
            >
              Add Sample
            </Button>
            <Button
              variant={mode === 'edit' ? 'default' : 'outline'}
              onClick={() => setMode('edit')}
            >
              Edit Sample
            </Button>
            <Button
              variant={mode === 'bulk' ? 'default' : 'outline'}
              onClick={() => setMode('bulk')}
            >
              Bulk Import
            </Button>
            <Button
              variant={mode === 'search' ? 'default' : 'outline'}
              onClick={() => setMode('search')}
            >
              Search Samples
            </Button>

            <Button
              variant="outline"
              onClick={refreshDatabase}
              disabled={refreshing}
              className="ml-auto border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              {refreshing ? '🔄 Refreshing...' : '🔄 Refresh Database'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {mode === 'edit' && (
            <div className="space-y-2">
              <Label>Load Sample by Kit Number</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Kit Number"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      fetchSample((e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    const input = document.querySelector('input[placeholder="Enter Kit Number"]') as HTMLInputElement;
                    if (input?.value) fetchSample(input.value);
                  }}
                  disabled={loading}
                >
                  Load
                </Button>
              </div>
            </div>
          )}

          {mode === 'search' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>General Search (all fields)</Label>
                  <Input
                    value={searchFilters.search}
                    onChange={(e) => setSearchFilters({ ...searchFilters, search: e.target.value })}
                    placeholder="Search in all fields..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') searchSamples(true);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={searchFilters.name}
                    onChange={(e) => setSearchFilters({ ...searchFilters, name: e.target.value })}
                    placeholder="Filter by name..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={searchFilters.country}
                    onChange={(e) => setSearchFilters({ ...searchFilters, country: e.target.value })}
                    placeholder="Filter by country..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Haplogroup</Label>
                  <Input
                    value={searchFilters.haplogroup}
                    onChange={(e) => setSearchFilters({ ...searchFilters, haplogroup: e.target.value })}
                    placeholder="Filter by haplogroup..."
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => searchSamples(true)} disabled={searching}>
                  {searching ? 'Searching...' : 'Search'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchFilters({ search: '', name: '', country: '', haplogroup: '', limit: 50, offset: 0 });
                    setSearchResults(null);
                  }}
                >
                  Clear
                </Button>
              </div>

              {searchResults && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium">Kit Number</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Name</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Country</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Haplogroup</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Markers</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.samples.map((sample, idx) => (
                          <tr key={idx} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-mono">{sample.kitNumber}</td>
                            <td className="px-4 py-2 text-sm">{sample.name || '-'}</td>
                            <td className="px-4 py-2 text-sm">{sample.country || '-'}</td>
                            <td className="px-4 py-2 text-sm">{sample.haplogroup || '-'}</td>
                            <td className="px-4 py-2 text-sm text-center">{sample.markerCount}</td>
                            <td className="px-4 py-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSample(sample);
                                  setMode('edit');
                                }}
                              >
                                Edit
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing {searchResults.pagination.offset + 1} - {searchResults.pagination.offset + searchResults.samples.length} of {searchResults.pagination.total}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSearchFilters({ ...searchFilters, offset: Math.max(0, searchFilters.offset - searchFilters.limit) });
                          setTimeout(() => searchSamples(false), 0);
                        }}
                        disabled={searchFilters.offset === 0 || searching}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSearchFilters({ ...searchFilters, offset: searchFilters.offset + searchFilters.limit });
                          setTimeout(() => searchSamples(false), 0);
                        }}
                        disabled={!searchResults.pagination.hasMore || searching}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {(mode === 'add' || mode === 'edit') && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kit Number *</Label>
                  <Input
                    value={sample.kitNumber}
                    onChange={(e) => setSample({ ...sample, kitNumber: e.target.value })}
                    disabled={mode === 'edit'}
                    placeholder="e.g., 55520"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={sample.name}
                    onChange={(e) => setSample({ ...sample, name: e.target.value })}
                    placeholder="e.g., John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input
                    value={sample.country}
                    onChange={(e) => setSample({ ...sample, country: e.target.value })}
                    placeholder="e.g., USA"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Haplogroup</Label>
                  <Input
                    value={sample.haplogroup}
                    onChange={(e) => setSample({ ...sample, haplogroup: e.target.value })}
                    placeholder="e.g., R-M269"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>STR Markers</Label>
                <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto p-2 border rounded">
                  {COMMON_STR_MARKERS.map(marker => (
                    <div key={marker} className="flex items-center gap-2">
                      <Label className="text-xs w-20">{marker}</Label>
                      <Input
                        className="h-8"
                        value={sample.markers[marker] || ''}
                        onChange={(e) => {
                          const newMarkers = { ...sample.markers };
                          if (e.target.value.trim()) {
                            newMarkers[marker] = e.target.value.trim();
                          } else {
                            delete newMarkers[marker];
                          }
                          setSample({ ...sample, markers: newMarkers });
                        }}
                        placeholder="-"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Filled markers: {Object.keys(sample.markers).length}
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveSample} disabled={loading} className="flex-1">
                  {loading ? 'Saving...' : mode === 'add' ? 'Add Sample' : 'Update Sample'}
                </Button>
                {mode === 'edit' && (
                  <Button
                    onClick={deleteSample}
                    disabled={loading}
                    variant="outline"
                    className="px-6 border-red-500 text-red-500 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                )}
              </div>
            </>
          )}

          {mode === 'bulk' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Paste data from Excel or CSV</Label>
                <textarea
                  className="w-full h-64 p-2 border rounded font-mono text-sm"
                  value={clipboardText}
                  onChange={(e) => setClipboardText(e.target.value)}
                  placeholder="Paste your data here (with headers)&#10;Example:&#10;Kit Number,Name,Country,Haplogroup,DYS393,DYS390...&#10;55520,Pizhinov,Circassia,J-Y94477,12,22..."
                />
              </div>

              <div className="space-y-2">
                <Label>Or upload CSV file</Label>
                <Input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={parseClipboardData} variant="outline">
                  Parse Data
                </Button>
                {parsedSamples.length > 0 && (
                  <Button onClick={uploadParsedSamples} disabled={loading}>
                    {loading ? 'Uploading...' : `Upload ${parsedSamples.length} Samples`}
                  </Button>
                )}
              </div>

              {parsedSamples.length > 0 && (
                <div className="border rounded p-4 max-h-96 overflow-y-auto">
                  <h4 className="font-semibold mb-2">Parsed Samples ({parsedSamples.length})</h4>
                  <div className="space-y-2">
                    {parsedSamples.slice(0, 10).map((s, idx) => (
                      <div key={idx} className="text-sm border-b pb-2">
                        <strong>{s.kitNumber}</strong> - {s.name} ({s.haplogroup}) - {Object.keys(s.markers).length} markers
                      </div>
                    ))}
                    {parsedSamples.length > 10 && (
                      <p className="text-xs text-gray-500">... and {parsedSamples.length - 10} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SampleManager;
