"use client";

import dynamic from 'next/dynamic';
import React from 'react';

interface BackendSearchProps {}

const BackendSearch = dynamic<BackendSearchProps>(
  () => import('@/components/str-matcher/BackendSearch').then(mod => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    ),
  }
);

export default function BackendSearchPage() {
  return (
    <main className="min-h-screen bg-background-primary text-text-primary">
      <BackendSearch />
    </main>
  );
}
