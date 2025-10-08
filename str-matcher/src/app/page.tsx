"use client";

import dynamic from 'next/dynamic';
import React from 'react';

interface STRMatcherProps {}

const STRMatcher = dynamic<STRMatcherProps>(
  () => import('@/components/str-matcher/STRMatcher').then(mod => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <main className="min-h-screen p-4 bg-background-primary text-text-primary">
      {/* Navigation Banner */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-1">
                🚀 New: Accelerated Database Search
              </h2>
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                Search through 162,000+ profiles using our high-performance PostgreSQL backend
              </p>
            </div>
            <a
              href="/backend-search"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Try New Search →
            </a>
          </div>
        </div>
      </div>
      <STRMatcher />
    </main>
  );
}