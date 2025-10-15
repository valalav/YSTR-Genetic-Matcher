"use client";

import React, { useState, useCallback } from 'react';
import { Upload, X, FileText, Table, Copy } from 'lucide-react';
import type { STRProfile } from '@/utils/constants';

interface ImportProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (profiles: STRProfile[], stats: ImportStats) => void;
}

interface ImportStats {
  totalImported: number;
  newProfiles: number;
  overriddenProfiles: number;
  skippedProfiles: number;
}

// FTDNA marker order for parsing
const FTDNA_MARKER_ORDER = [
  'DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385', 'DYS426', 'DYS388', 'DYS439', 'DYS389i', 'DYS392', 'DYS389ii',
  'DYS458', 'DYS459', 'DYS455', 'DYS454', 'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464',
  'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607', 'DYS576', 'DYS570', 'CDY', 'DYS442', 'DYS438',
  'DYS531', 'DYS578', 'DYF395S1', 'DYS590', 'DYS537', 'DYS641', 'DYS472', 'DYF406S1', 'DYS511',
  'DYS425', 'DYS413', 'DYS557', 'DYS594', 'DYS436', 'DYS490', 'DYS534', 'DYS450', 'DYS444', 'DYS481', 'DYS520', 'DYS446',
  'DYS617', 'DYS568', 'DYS487', 'DYS572', 'DYS640', 'DYS492', 'DYS565',
  'DYS710', 'DYS485', 'DYS632', 'DYS495', 'DYS540', 'DYS714', 'DYS716', 'DYS717',
  'DYS505', 'DYS556', 'DYS549', 'DYS589', 'DYS522', 'DYS494', 'DYS533', 'DYS636', 'DYS575', 'DYS638',
  'DYS462', 'DYS452', 'DYS445', 'Y-GATA-A10', 'DYS463', 'DYS441', 'Y-GGAAT-1B07', 'DYS525',
  'DYS712', 'DYS593', 'DYS650', 'DYS532', 'DYS715', 'DYS504', 'DYS513', 'DYS561', 'DYS552',
  'DYS726', 'DYS635', 'DYS587', 'DYS643', 'DYS497', 'DYS510', 'DYS434', 'DYS461', 'DYS435'
];

const ImportProfilesModal: React.FC<ImportProfilesModalProps> = ({ isOpen, onClose, onImport }) => {
  const [importType, setImportType] = useState<'paste' | 'csv'>('paste');
  const [textInput, setTextInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<STRProfile[]>([]);

  // Parse CSV content
  const parseCSV = useCallback((content: string): STRProfile[] => {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return [];

    // Detect delimiter (comma, semicolon, or tab)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' :
                     firstLine.includes('\t') ? '\t' : ',';

    // Parse header
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));

    // Find column indices
    const kitNumberIdx = headers.findIndex(h =>
      h.toLowerCase().includes('kit') || h.toLowerCase().includes('id')
    );
    const nameIdx = headers.findIndex(h => h.toLowerCase().includes('name'));
    const haplogroupIdx = headers.findIndex(h =>
      h.toLowerCase().includes('haplogroup') || h.toLowerCase().includes('haplo')
    );
    const countryIdx = headers.findIndex(h => h.toLowerCase().includes('country'));

    // Find marker columns
    const markerIndices: Record<string, number> = {};
    FTDNA_MARKER_ORDER.forEach(marker => {
      const idx = headers.findIndex(h => h.toUpperCase() === marker.toUpperCase());
      if (idx !== -1) {
        markerIndices[marker] = idx;
      }
    });

    const profiles: STRProfile[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));

      const kitNumber = kitNumberIdx !== -1 ? values[kitNumberIdx] : `IMPORTED_${i}`;
      if (!kitNumber) continue;

      const markers: Record<string, string> = {};
      Object.entries(markerIndices).forEach(([marker, idx]) => {
        const value = values[idx];
        if (value && value !== '' && value !== '-' && value !== 'null') {
          markers[marker] = value;
        }
      });

      // Skip if no markers
      if (Object.keys(markers).length === 0) continue;

      profiles.push({
        kitNumber,
        name: nameIdx !== -1 ? values[nameIdx] : undefined,
        haplogroup: haplogroupIdx !== -1 ? values[haplogroupIdx] : undefined,
        country: countryIdx !== -1 ? values[countryIdx] : undefined,
        markers,
      });
    }

    return profiles;
  }, []);

  // Parse pasted text (from browser/Excel)
  const parsePastedText = useCallback((content: string): STRProfile[] => {
    // Try to detect if it's CSV format
    if (content.includes(',') || content.includes(';')) {
      return parseCSV(content);
    }

    // Parse tab-separated values (from Excel)
    const lines = content.trim().split('\n');
    if (lines.length === 0) return [];

    const profiles: STRProfile[] = [];

    for (let i = 0; i < lines.length; i++) {
      const values = lines[i].split('\t').map(v => v.trim());

      // Assume first column is kit number, rest are markers in FTDNA order
      const kitNumber = values[0];
      if (!kitNumber || kitNumber === '') continue;

      const markers: Record<string, string> = {};

      // Map values to markers in FTDNA order
      for (let j = 1; j < values.length && j - 1 < FTDNA_MARKER_ORDER.length; j++) {
        const value = values[j];
        if (value && value !== '' && value !== '-' && value !== 'null') {
          markers[FTDNA_MARKER_ORDER[j - 1]] = value;
        }
      }

      if (Object.keys(markers).length > 0) {
        profiles.push({
          kitNumber,
          markers,
        });
      }
    }

    return profiles;
  }, [parseCSV]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = parseCSV(content);
        setPreview(parsed);
        setError(null);
      } catch (err) {
        setError(`File parsing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setPreview([]);
      }
    };
    reader.readAsText(file);
  }, [parseCSV]);

  // Handle text paste
  const handleTextPaste = useCallback(() => {
    try {
      const parsed = importType === 'csv' ? parseCSV(textInput) : parsePastedText(textInput);
      setPreview(parsed);
      setError(null);
    } catch (err) {
      setError(`Ошибка парсинга: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setPreview([]);
    }
  }, [textInput, importType, parseCSV, parsePastedText]);

  // Handle import
  const handleImport = useCallback(() => {
    if (preview.length === 0) {
      setError('No profiles to import');
      return;
    }

    const stats: ImportStats = {
      totalImported: preview.length,
      newProfiles: preview.length, // Will be calculated by parent
      overriddenProfiles: 0,
      skippedProfiles: 0,
    };

    onImport(preview, stats);
    setTextInput('');
    setPreview([]);
    onClose();
  }, [preview, onImport, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Upload className="h-6 w-6" />
            <h2 className="text-xl font-bold">Import Profiles</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Import Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Тип импорта
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setImportType('paste')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                  importType === 'paste'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <Copy className="h-5 w-5" />
                Вставить из Excel/Браузера
              </button>
              <button
                onClick={() => setImportType('csv')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                  importType === 'csv'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <FileText className="h-5 w-5" />
                CSV файл
              </button>
            </div>
          </div>

          {/* Import Area */}
          {importType === 'paste' ? (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Вставьте данные (из Excel, браузера или таблицы)
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Kit Number&#9;DYS393&#9;DYS390&#9;DYS19&#9;...&#10;B503239&#9;12&#9;22&#9;15&#9;...&#10;123456&#9;13&#9;24&#9;14&#9;..."
                className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              />
              <p className="mt-2 text-sm text-gray-500">
                Формат: Kit Number и маркеры через TAB (как при копировании из Excel)
              </p>
              <button
                onClick={handleTextPaste}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Распарсить данные
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Загрузите CSV файл
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-12 w-12 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Нажмите для выбора CSV файла
                  </span>
                  <span className="text-xs text-gray-500">
                    Поддерживаются разделители: ; , TAB
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">
                Preview ({preview.length} profiles)
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">Kit Number</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Haplogroup</th>
                      <th className="px-4 py-2 text-left">Маркеров</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((profile, idx) => (
                      <tr key={idx} className="border-t border-gray-100">
                        <td className="px-4 py-2 font-mono">{profile.kitNumber}</td>
                        <td className="px-4 py-2">{profile.name || '-'}</td>
                        <td className="px-4 py-2">{profile.haplogroup || '-'}</td>
                        <td className="px-4 py-2">{Object.keys(profile.markers).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <div className="p-2 bg-gray-50 text-center text-xs text-gray-500">
                    ... и еще {preview.length - 10} profiles
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Важная информация:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Imported profiles are saved only in the current session</li>
              <li>• Они НЕ добавляются в базу данных</li>
              <li>• При совпадении Kit Number приоритет у импортированных profiles</li>
              <li>• Imported profiles will disappear after page reload</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
          <div className="text-sm text-gray-600">
            {preview.length > 0 && `Ready to import: ${preview.length} profiles`}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleImport}
              disabled={preview.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Import {preview.length > 0 && `(${preview.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportProfilesModal;
