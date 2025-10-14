"use client";

import dynamic from 'next/dynamic';
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SampleManager = dynamic(
  () => import('@/components/str-matcher/SampleManager'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    ),
  }
);

export default function SamplesPage() {
  const [apiKey, setApiKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => {
    if (apiKey.trim()) {
      // Store API key in sessionStorage
      sessionStorage.setItem('dna_api_key', apiKey);
      setIsAuthenticated(true);
    }
  };

  // Check if already authenticated
  React.useEffect(() => {
    const storedKey = sessionStorage.getItem('dna_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setIsAuthenticated(true);
    }
  }, []);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sample Manager - Authentication Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              API key is required to add or edit samples. Contact administrator to get your API key.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Sample Manager</h1>
          <Button
            variant="outline"
            onClick={() => {
              sessionStorage.removeItem('dna_api_key');
              setIsAuthenticated(false);
              setApiKey('');
            }}
          >
            Logout
          </Button>
        </div>
        <SampleManager apiKey={apiKey} />
      </div>
    </main>
  );
}
