"use client";

import React, { useEffect } from 'react';
import { useHaplogroupsList } from '@/hooks/useHaplogroupsList';

interface HaplogroupSelectorProps {
  selectedHaplogroup: string;
  onHaplogroupChange: (haplogroup: string) => void;
  minProfiles?: number;
}

const HaplogroupSelector: React.FC<HaplogroupSelectorProps> = ({
  selectedHaplogroup,
  onHaplogroupChange,
  minProfiles = 500
}) => {
  const { haplogroups, loading, error } = useHaplogroupsList(minProfiles);

  if (loading) {
    return (
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-gray-700">Haplogroup Filter</label>
        <div className="w-full px-3 py-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-gray-600">Loading haplogroups...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-gray-700">Haplogroup Filter</label>
        <div className="w-full px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-xs text-red-600">Failed to load haplogroups</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-700">
        Haplogroup Filter
        {selectedHaplogroup && (
          <span className="ml-2 text-xs font-normal text-blue-600">
            (Filtering active)
          </span>
        )}
      </label>
      <div className="relative">
        <select
          value={selectedHaplogroup}
          onChange={(e) => onHaplogroupChange(e.target.value)}
          className="w-full px-3 py-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all duration-300 text-sm appearance-none cursor-pointer"
        >
          <option value="">🌍 All Haplogroups ({haplogroups.reduce((sum, h) => sum + h.total_profiles, 0).toLocaleString()} profiles)</option>
          {haplogroups.map((haplo) => (
            <option key={haplo.haplogroup} value={haplo.haplogroup}>
              {haplo.haplogroup} ({haplo.total_profiles.toLocaleString()} profiles)
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {selectedHaplogroup && (
        <div className="mt-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          🎯 Searching only in <strong>{selectedHaplogroup}</strong> haplogroup
        </div>
      )}
    </div>
  );
};

export default HaplogroupSelector;
