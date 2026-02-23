import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import * as settingsService from '../../services/settings';
import { APIError } from '../../services/api';

export default function SettingsForm() {
  const { token } = useAuth();
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [notionApiKey, setNotionApiKey] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      if (!token) return;

      try {
        const settings = await settingsService.getSettings(token);
        setSlackWebhookUrl(settings.slackWebhookUrl || '');
        setNotionApiKey(settings.notionApiKey || '');
        setNotionDatabaseId(settings.notionDatabaseId || '');
      } catch (err) {
        if (err instanceof APIError) {
          setError(err.message);
        } else {
          setError('Failed to load settings');
        }
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await settingsService.updateSettings(token, {
        slackWebhookUrl: slackWebhookUrl || null,
        notionApiKey: notionApiKey || null,
        notionDatabaseId: notionDatabaseId || null,
      });
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError('Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
          Integration Settings
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure your Slack and Notion integrations for email processing
        </p>
      </div>

      <div>
        <label htmlFor="slackWebhookUrl" className="block text-sm font-medium text-gray-700">
          Slack Webhook URL
        </label>
        <input
          type="url"
          id="slackWebhookUrl"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="https://hooks.slack.com/services/..."
          value={slackWebhookUrl}
          onChange={(e) => setSlackWebhookUrl(e.target.value)}
        />
        <p className="mt-2 text-sm text-gray-500">
          Used for sending notifications to your Slack channel
        </p>
      </div>

      <div>
        <label htmlFor="notionApiKey" className="block text-sm font-medium text-gray-700">
          Notion API Key
        </label>
        <input
          type="password"
          id="notionApiKey"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="secret_..."
          value={notionApiKey}
          onChange={(e) => setNotionApiKey(e.target.value)}
        />
        <p className="mt-2 text-sm text-gray-500">
          Your Notion integration secret
        </p>
      </div>

      <div>
        <label htmlFor="notionDatabaseId" className="block text-sm font-medium text-gray-700">
          Notion Database ID
        </label>
        <input
          type="text"
          id="notionDatabaseId"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="abc123..."
          value={notionDatabaseId}
          onChange={(e) => setNotionDatabaseId(e.target.value)}
        />
        <p className="mt-2 text-sm text-gray-500">
          The database where schedules will be created
        </p>
      </div>

      <div className="pt-5">
        <button
          type="submit"
          disabled={saving}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
