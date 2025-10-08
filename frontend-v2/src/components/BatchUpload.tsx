/**
 * Optimized batch upload component for large CSV files
 * Supports drag & drop, progress tracking, and chunk processing
 */

import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { useDataStore, useBatchStatus } from '../stores/dataStore';
import { toast } from 'react-hot-toast';
import Papa from 'papaparse';

interface BatchUploadProps {
  onUploadComplete?: (result: any) => void;
  maxFileSize?: number;
  maxProfiles?: number;
}

interface PreviewData {
  totalRows: number;
  sampleRows: any[];
  headers: string[];
  estimatedProfiles: number;
  fileSize: string;
}

const BatchUpload: React.FC<BatchUploadProps> = ({
  onUploadComplete,
  maxFileSize = 100 * 1024 * 1024, // 100MB
  maxProfiles = 200000
}) => {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const { startBatchUpload } = useDataStore();
  const batchStatus = useBatchStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File validation and preview
  const validateAndPreviewFile = useCallback(async (file: File) => {
    if (file.size > maxFileSize) {
      throw new Error(`File too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB`);
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      throw new Error('Only CSV files are supported');
    }

    return new Promise<PreviewData>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const csvText = e.target?.result as string;

        Papa.parse(csvText, {
          header: true,
          preview: 100, // Only parse first 100 rows for preview
          skipEmptyLines: true,
          complete: (results) => {
            const errors: string[] = [];

            // Validate headers
            const headers = results.meta.fields || [];
            const requiredHeaders = ['kitNumber', 'name'];
            const markerHeaders = headers.filter(h =>
              !['kitNumber', 'name', 'country', 'haplogroup'].includes(h.toLowerCase())
            );

            const missingRequired = requiredHeaders.filter(required =>
              !headers.some(h => h.toLowerCase() === required.toLowerCase())
            );

            if (missingRequired.length > 0) {
              errors.push(`Missing required columns: ${missingRequired.join(', ')}`);
            }

            if (markerHeaders.length === 0) {
              errors.push('No STR marker columns found');
            }

            // Estimate total rows (approximate based on file size and sample)
            const avgRowSize = csvText.length / Math.max(results.data.length, 1);
            const estimatedTotalRows = Math.floor(file.size / avgRowSize);

            if (estimatedTotalRows > maxProfiles) {
              errors.push(`Too many profiles. Maximum ${maxProfiles.toLocaleString()} allowed, estimated ${estimatedTotalRows.toLocaleString()}`);
            }

            const previewData: PreviewData = {
              totalRows: estimatedTotalRows,
              sampleRows: results.data.slice(0, 5),
              headers,
              estimatedProfiles: estimatedTotalRows,
              fileSize: formatFileSize(file.size)
            };

            if (errors.length > 0) {
              setValidationErrors(errors);
            } else {
              setValidationErrors([]);
            }

            resolve(previewData);
          },
          error: (error) => {
            reject(new Error(`CSV parsing error: ${error.message}`));
          }
        });
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }, [maxFileSize, maxProfiles]);

  // Handle file drop/selection
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    setPreview(null);
    setValidationErrors([]);

    try {
      const previewData = await validateAndPreviewFile(file);
      setPreview(previewData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'File validation failed';
      toast.error(message);
      setValidationErrors([message]);
    } finally {
      setIsProcessing(false);
    }
  }, [validateAndPreviewFile]);

  // Configure dropzone
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject
  } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxSize: maxFileSize,
    multiple: false
  });

  // Handle upload confirmation
  const handleUpload = useCallback(async () => {
    if (!fileInputRef.current?.files?.[0] || validationErrors.length > 0) return;

    const file = fileInputRef.current.files[0];

    try {
      await startBatchUpload(file);
      toast.success('Upload started successfully');
      onUploadComplete?.(batchStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      toast.error(message);
    }
  }, [validationErrors, startBatchUpload, onUploadComplete, batchStatus]);

  // Reset preview
  const handleReset = useCallback(() => {
    setPreview(null);
    setValidationErrors([]);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragActive && !isDragReject
            ? 'border-blue-400 bg-blue-50'
            : isDragReject
            ? 'border-red-400 bg-red-50'
            : 'border-gray-300 hover:border-gray-400'
          }
          ${isProcessing ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        `}
      >
        <input {...getInputProps()} ref={fileInputRef} />

        <AnimatePresence>
          {isProcessing ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Processing file...</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <div>
                <p className="text-lg font-medium text-gray-900">
                  {isDragActive
                    ? 'Drop your CSV file here'
                    : 'Drag & drop your CSV file here'
                  }
                </p>
                <p className="text-gray-500">or click to browse</p>
              </div>

              <div className="text-sm text-gray-500">
                <p>Supports up to {Math.round(maxFileSize / 1024 / 1024)}MB files</p>
                <p>Maximum {maxProfiles.toLocaleString()} profiles</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Validation Errors */}
      <AnimatePresence>
        {validationErrors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4"
          >
            <div className="flex">
              <svg className="h-5 w-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Validation Errors</h3>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Preview */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-50 border border-gray-200 rounded-lg p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-gray-900">File Preview</h3>
              <button
                onClick={handleReset}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* File Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-500">File Size</p>
                <p className="text-2xl font-bold text-gray-900">{preview.fileSize}</p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-500">Estimated Profiles</p>
                <p className="text-2xl font-bold text-gray-900">{preview.estimatedProfiles.toLocaleString()}</p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-500">Columns</p>
                <p className="text-2xl font-bold text-gray-900">{preview.headers.length}</p>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-500">STR Markers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {preview.headers.filter(h =>
                    !['kitNumber', 'name', 'country', 'haplogroup'].includes(h.toLowerCase())
                  ).length}
                </p>
              </div>
            </div>

            {/* Sample Data Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h4 className="text-sm font-medium text-gray-900">Sample Data (first 5 rows)</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {preview.headers.slice(0, 8).map((header, index) => (
                        <th
                          key={index}
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header}
                        </th>
                      ))}
                      {preview.headers.length > 8 && (
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          +{preview.headers.length - 8} more...
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.sampleRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {preview.headers.slice(0, 8).map((header, colIndex) => (
                          <td
                            key={colIndex}
                            className="px-3 py-2 whitespace-nowrap text-sm text-gray-900"
                          >
                            {row[header] || '-'}
                          </td>
                        ))}
                        {preview.headers.length > 8 && (
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                            ...
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={validationErrors.length > 0}
                className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload {preview.estimatedProfiles.toLocaleString()} Profiles
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Status */}
      <AnimatePresence>
        {batchStatus && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {batchStatus.status === 'completed' ? (
                  <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : batchStatus.status === 'failed' ? (
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                )}
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-blue-800">
                  {batchStatus.status === 'uploading' && 'Uploading file...'}
                  {batchStatus.status === 'processing' && 'Processing profiles...'}
                  {batchStatus.status === 'completed' && 'Upload completed successfully!'}
                  {batchStatus.status === 'failed' && 'Upload failed'}
                </h3>
                {batchStatus.progress > 0 && (
                  <div className="mt-2">
                    <div className="bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${batchStatus.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      {batchStatus.progress}% complete
                      {batchStatus.processedProfiles > 0 && (
                        <span> • {batchStatus.processedProfiles.toLocaleString()} profiles processed</span>
                      )}
                    </p>
                  </div>
                )}
                {batchStatus.error && (
                  <p className="text-sm text-red-600 mt-1">{batchStatus.error}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BatchUpload;