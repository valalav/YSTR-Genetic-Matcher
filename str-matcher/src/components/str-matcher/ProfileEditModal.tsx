"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SampleManager from './SampleManager';

interface ProfileEditModalProps {
  kitNumber: string;
  onClose: () => void;
  onUpdate?: () => void;
  onDelete?: () => void;
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ kitNumber, onClose, onUpdate, onDelete }) => {
  const [apiKey, setApiKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  // Check if already authenticated
  useEffect(() => {
    const storedKey = sessionStorage.getItem('dna_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      // Validate stored key
      validateApiKey(storedKey);
    }
  }, []);

  const validateApiKey = async (keyToValidate: string) => {
    setIsValidating(true);
    setError('');

    try {
      // Use the fast validation endpoint
      const response = await fetch('/api/samples/validate-key', {
        method: 'POST',
        headers: {
          'X-API-Key': keyToValidate,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (response.ok) {
        // Key is valid
        sessionStorage.setItem('dna_api_key', keyToValidate);
        setIsAuthenticated(true);
        setError('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        // Key is invalid
        setIsAuthenticated(false);
        sessionStorage.removeItem('dna_api_key');
        setError(errorData.message || 'Invalid API key. Please check and try again.');
      }
    } catch (err) {
      setIsAuthenticated(false);
      sessionStorage.removeItem('dna_api_key');
      setError('Failed to validate API key. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleLogin = () => {
    if (apiKey.trim()) {
      validateApiKey(apiKey.trim());
    } else {
      setError('Please enter an API key');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Edit Profile: {kitNumber}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {!isAuthenticated ? (
            <div className="max-w-md mx-auto space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  disabled={isValidating}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isValidating) handleLogin();
                  }}
                />
              </div>
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                  {error}
                </div>
              )}
              <Button onClick={handleLogin} className="w-full" disabled={isValidating}>
                {isValidating ? 'Validating...' : 'Login'}
              </Button>
              <p className="text-xs text-gray-500 text-center">
                API key is required to edit samples. Contact administrator to get your API key.
              </p>
            </div>
          ) : (
            <SampleManager
              apiKey={apiKey}
              initialKitNumber={kitNumber}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileEditModal;
