'use client';

import { useState, useEffect } from 'react';
import { TransactionLog } from '@/lib/types';

export default function Home() {
  const [logs, setLogs] = useState<TransactionLog[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenCount, setTokenCount] = useState(1000);

  useEffect(() => {
    const interval = setInterval(fetchLogs, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const initializeAgents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/agents/initialize', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsInitialized(true);
      } else {
        alert('Failed to initialize: ' + data.error);
      }
    } catch (error) {
      alert('Error: ' + error);
    }
    setIsLoading(false);
  };

  const triggerPurchase = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/agents/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_count: tokenCount }),
      });
      const data = await res.json();
      if (!data.success) {
        alert('Failed to trigger purchase: ' + data.error);
      }
    } catch (error) {
      alert('Error: ' + error);
    }
    setIsLoading(false);
  };

  const resetSystem = async () => {
    if (!confirm('Are you sure you want to reset the entire system?')) return;
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsInitialized(false);
        setLogs([]);
      }
    } catch (error) {
      alert('Error: ' + error);
    }
    setIsLoading(false);
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'sent': return '📤';
      case 'received': return '📥';
      case 'message': return '💬';
      default: return '📝';
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'sent': return 'text-blue-600';
      case 'received': return 'text-green-600';
      case 'message': return 'text-gray-600';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🤖 Autonomous Agent Economy - POC Demo
          </h1>
          <p className="text-gray-600">
            Watch two AI agents transact autonomously without human intervention
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Control Panel</h2>
          
          <div className="space-y-4">
            {!isInitialized ? (
              <button
                onClick={initializeAgents}
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Initializing...' : '🚀 Initialize Agents'}
              </button>
            ) : (
              <>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Token Count
                    </label>
                    <input
                      type="number"
                      value={tokenCount}
                      onChange={(e) => setTokenCount(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      min="1"
                      max="10000"
                    />
                  </div>
                  <div className="flex-1 flex items-end">
                    <button
                      onClick={triggerPurchase}
                      disabled={isLoading}
                      className="w-full bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? 'Processing...' : '💰 Trigger Purchase'}
                    </button>
                  </div>
                </div>

                <button
                  onClick={resetSystem}
                  disabled={isLoading}
                  className="w-full bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  🔄 Reset System
                </button>
              </>
            )}
          </div>

          {isInitialized && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">
                ✅ Agents are online and ready to transact!
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Transaction Log</h2>
          
          {logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No activity yet</p>
              <p className="text-sm mt-2">Initialize agents to begin</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getLogIcon(log.type)}</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-gray-900">
                          {log.agent_id}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className={`${getLogColor(log.type)} text-sm`}>
                        {log.message}
                      </p>
                      {log.data && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                            View data
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-900 text-green-400 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-indigo-900 mb-2">How it works:</h3>
          <ol className="space-y-2 text-sm text-indigo-800">
            <li>1. <strong>Buyer Agent</strong> searches for GPT-4 token provider</li>
            <li>2. <strong>Seller Agent</strong> responds with quote</li>
            <li>3. <strong>Buyer Agent</strong> auto-accepts and pays (funds transfer immediately)</li>
            <li>4. <strong>Seller Agent</strong> delivers tokens</li>
            <li>5. <strong>Seller Agent</strong> confirms delivery</li>
            <li>6. ✅ <strong>Transaction complete</strong> - all autonomous!</li>
          </ol>
          <p className="mt-4 text-xs text-indigo-600">
            💡 Payment has 24hr refund window. Buyer can dispute if service not delivered.
          </p>
        </div>
      </div>
    </div>
  );
}
