"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SampleManager from './SampleManager';

interface ProfileEditModalProps {
  kitNumber: string;
  onClose: () => void;
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ kitNumber, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    const storedKey = sessionStorage.getItem('dna_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    if (apiKey.trim()) {
      // Store API key in sessionStorage
      sessionStorage.setItem('dna_api_key', apiKey);
      setIsAuthenticated(true);
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
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleLogin();
                  }}
                />
              </div>
              <Button onClick={handleLogin} className="w-full">
                Login
              </Button>
              <p className="text-xs text-gray-500 text-center">
                API key is required to edit samples. Contact administrator to get your API key.
              </p>
            </div>
          ) : (
            <SampleManager apiKey={apiKey} initialKitNumber={kitNumber} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileEditModal;
