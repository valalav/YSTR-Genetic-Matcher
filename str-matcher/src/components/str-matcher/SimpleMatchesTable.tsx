"use client";

import React from 'react';
import type { STRMatch, STRProfile } from '@/utils/constants';

interface SimpleMatchesTableProps {
  matches: STRMatch[];
  query: STRProfile | null;
}

const SimpleMatchesTable: React.FC<SimpleMatchesTableProps> = ({ matches, query }) => {
  if (!matches || matches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No matches found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-300 px-4 py-2 text-left">Kit Number</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Country</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Haplogroup</th>
            <th className="border border-gray-300 px-4 py-2 text-center">Distance</th>
            <th className="border border-gray-300 px-4 py-2 text-center">Compared</th>
            <th className="border border-gray-300 px-4 py-2 text-center">Identical</th>
            <th className="border border-gray-300 px-4 py-2 text-center">Match %</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match, index) => (
            <tr
              key={match.profile?.kitNumber || index}
              className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
            >
              <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                {match.profile?.kitNumber || 'N/A'}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {match.profile?.name || 'Unknown'}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {match.profile?.country || 'Unknown'}
              </td>
              <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                {match.profile?.haplogroup || 'Unknown'}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                <span
                  className={`px-2 py-1 rounded text-white text-sm ${
                    match.distance === 0
                      ? 'bg-green-600'
                      : match.distance <= 2
                      ? 'bg-blue-600'
                      : match.distance <= 5
                      ? 'bg-yellow-600'
                      : 'bg-red-600'
                  }`}
                >
                  {match.distance}
                </span>
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                {match.comparedMarkers}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                {match.identicalMarkers}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                <span className="font-semibold">
                  {typeof match.percentIdentical === 'number'
                    ? `${match.percentIdentical.toFixed(1)}%`
                    : `${match.percentIdentical}%`
                  }
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {matches.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          <p>
            <strong>Total matches:</strong> {matches.length}
          </p>
          <p>
            <strong>Distance legend:</strong>
            <span className="ml-2">
              <span className="inline-block w-3 h-3 bg-green-600 rounded mr-1"></span>
              Exact (0)
            </span>
            <span className="ml-2">
              <span className="inline-block w-3 h-3 bg-blue-600 rounded mr-1"></span>
              Close (1-2)
            </span>
            <span className="ml-2">
              <span className="inline-block w-3 h-3 bg-yellow-600 rounded mr-1"></span>
              Moderate (3-5)
            </span>
            <span className="ml-2">
              <span className="inline-block w-3 h-3 bg-red-600 rounded mr-1"></span>
              Distant (6+)
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

export default SimpleMatchesTable;