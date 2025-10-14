'use client';

import React, { useState, useEffect } from 'react';

interface ApiKey {
  id: number;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  last_used_at: string | null;
  usage_count: number;
}

interface AuditLog {
  id: number;
  api_key_name: string;
  operation: string;
  table_name: string;
  record_id: string;
  created_at: string;
  ip_address: string;
  success: boolean;
}

export default function AdminPage() {
  const [masterKey, setMasterKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'keys' | 'audit'>('keys');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New key form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState({
    'samples.create': false,
    'samples.update': false,
    'samples.delete': false,
    'cache.clear': false,
    'admin.read': false,
  });
  const [generatedKey, setGeneratedKey] = useState('');

  // Check if already authenticated
  useEffect(() => {
    const storedKey = sessionStorage.getItem('admin_master_key');
    if (storedKey) {
      setMasterKey(storedKey);
      validateMasterKey(storedKey);
    }
  }, []);

  const validateMasterKey = async (key: string) => {
    try {
      const response = await fetch('/api/admin/keys', {
        headers: { 'X-API-Key': key }
      });

      if (response.ok) {
        setIsAuthenticated(true);
        sessionStorage.setItem('admin_master_key', key);
        loadKeys(key);
      } else {
        setMessage({ type: 'error', text: 'Invalid Master Key' });
        sessionStorage.removeItem('admin_master_key');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to validate Master Key' });
    }
  };

  const handleLogin = () => {
    if (masterKey.trim()) {
      validateMasterKey(masterKey.trim());
    }
  };

  const loadKeys = async (key: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/keys', {
        headers: { 'X-API-Key': key }
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.keys)) {
        setKeys(data.keys);
      } else {
        setKeys([]);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load keys' });
      setKeys([]);
    }
    setLoading(false);
  };

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/audit?limit=100', {
        headers: { 'X-API-Key': masterKey }
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.logs)) {
        setAuditLogs(data.logs);
      } else {
        setAuditLogs([]);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load audit logs' });
      setAuditLogs([]);
    }
    setLoading(false);
  };

  const createKey = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': masterKey
        },
        body: JSON.stringify({
          name: newKeyName,
          description: newKeyDescription,
          permissions: newKeyPermissions,
          expiresInDays: 365
        })
      });

      const data = await response.json();
      if (data.success) {
        setGeneratedKey(data.apiKey);
        setMessage({ type: 'success', text: 'API Key created successfully! Copy it now - it will not be shown again.' });
        loadKeys(masterKey);
        // Reset form
        setNewKeyName('');
        setNewKeyDescription('');
        setNewKeyPermissions({
          'samples.create': false,
          'samples.update': false,
          'samples.delete': false,
          'cache.clear': false,
          'admin.read': false,
        });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to create key' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create key' });
    }
    setLoading(false);
  };

  const deactivateKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to deactivate this key?')) return;

    try {
      const response = await fetch(`/api/admin/keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': masterKey }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Key deactivated successfully' });
        loadKeys(masterKey);
      } else {
        setMessage({ type: 'error', text: 'Failed to deactivate key' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to deactivate key' });
    }
  };

  const logout = () => {
    sessionStorage.removeItem('admin_master_key');
    setIsAuthenticated(false);
    setMasterKey('');
    setKeys([]);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin Panel</h1>
          <p className="text-gray-600 mb-6 text-center">Enter Master API Key to access admin functions</p>

          {message && (
            <div className={`mb-4 p-3 rounded ${message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-4">
            <input
              type="password"
              value={masterKey}
              onChange={(e) => setMasterKey(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Master API Key"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {message.text}
          </div>
        )}

        {generatedKey && (
          <div className="mb-4 p-4 bg-yellow-100 border-2 border-yellow-400 rounded-lg">
            <p className="font-bold mb-2">⚠️ New API Key (save it now!):</p>
            <code className="block bg-white p-2 rounded break-all">{generatedKey}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedKey);
                setMessage({ type: 'success', text: 'Key copied to clipboard!' });
              }}
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={() => setGeneratedKey('')}
              className="mt-2 ml-2 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
            >
              Hide
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-4 py-2 font-medium ${activeTab === 'keys' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
          >
            API Keys
          </button>
          <button
            onClick={() => {
              setActiveTab('audit');
              loadAuditLogs();
            }}
            className={`px-4 py-2 font-medium ${activeTab === 'audit' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
          >
            Audit Logs
          </button>
        </div>

        {activeTab === 'keys' && (
          <div>
            {/* Create Key Button */}
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              {showCreateForm ? 'Cancel' : '+ Create New Key'}
            </button>

            {/* Create Key Form */}
            {showCreateForm && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Create New API Key</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., John Doe"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <input
                      type="text"
                      value={newKeyDescription}
                      onChange={(e) => setNewKeyDescription(e.target.value)}
                      placeholder="e.g., Research project XYZ"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Permissions</label>
                    <div className="space-y-2">
                      {Object.keys(newKeyPermissions).map((perm) => (
                        <label key={perm} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={newKeyPermissions[perm as keyof typeof newKeyPermissions]}
                            onChange={(e) => setNewKeyPermissions({
                              ...newKeyPermissions,
                              [perm]: e.target.checked
                            })}
                            className="rounded"
                          />
                          <span>{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={createKey}
                    disabled={loading || !newKeyName.trim()}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                  >
                    {loading ? 'Creating...' : 'Create Key'}
                  </button>
                </div>
              </div>
            )}

            {/* Keys List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Permissions</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Usage</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Array.isArray(keys) && keys.length > 0 ? (
                    keys.map((key) => (
                      <tr key={key.id} className={!key.is_active ? 'bg-gray-50 opacity-60' : ''}>
                        <td className="px-4 py-3 text-sm">{key.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{key.description}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-wrap gap-1">
                            {key.permissions && Object.entries(key.permissions).filter(([_, v]) => v).map(([perm]) => (
                              <span key={perm} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                {perm}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div>{key.usage_count} times</div>
                          {key.last_used_at && (
                            <div className="text-xs text-gray-500">
                              Last: {new Date(key.last_used_at).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${key.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {key.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {key.is_active && (
                            <button
                              onClick={() => deactivateKey(key.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        {loading ? 'Loading...' : 'No API keys found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Time</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">User</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Operation</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Record</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">IP</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Array.isArray(auditLogs) && auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-sm">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">{log.api_key_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          log.operation === 'CREATE' ? 'bg-green-100 text-green-800' :
                          log.operation === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                          log.operation === 'DELETE' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {log.operation}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{log.table_name}/{log.record_id}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.ip_address}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {log.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      {loading ? 'Loading...' : 'No audit logs found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
