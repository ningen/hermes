import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import * as settingsService from '../../services/settings';
import { APIError } from '../../services/api';

export default function SettingsForm() {
  const { token } = useAuth();
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [notionApiKey, setNotionApiKey] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [slackBotToken, setSlackBotToken] = useState('');
  const [slackSigningSecret, setSlackSigningSecret] = useState('');
  const [slackAllowedUserIds, setSlackAllowedUserIds] = useState('');
  const [slackInboundToken, setSlackInboundToken] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      if (!token) return;

      try {
        const settings = await settingsService.getSettings(token);
        setSlackWebhookUrl(settings.slackWebhookUrl || '');
        setNotionApiKey(settings.notionApiKey || '');
        setNotionDatabaseId(settings.notionDatabaseId || '');
        setSlackBotToken(settings.slackBotToken || '');
        setSlackSigningSecret(settings.slackSigningSecret || '');
        setSlackAllowedUserIds(settings.slackAllowedUserIds || '');
        setSlackInboundToken(settings.slackInboundToken);
        setGoogleConnected(settings.googleConnected);
        setGoogleCalendarId(settings.googleCalendarId || '');
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

    // Google OAuth コールバック後のクエリパラメータを処理
    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get('google');
    if (googleStatus === 'connected') {
      setSuccess('Google Calendar connected successfully!');
      setTimeout(() => setSuccess(''), 4000);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (googleStatus === 'error') {
      const reason = params.get('reason') ?? 'unknown';
      setError(`Failed to connect Google Calendar: ${reason}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const result = await settingsService.updateSettings(token, {
        slackWebhookUrl: slackWebhookUrl || null,
        notionApiKey: notionApiKey || null,
        notionDatabaseId: notionDatabaseId || null,
        slackBotToken: slackBotToken || null,
        slackSigningSecret: slackSigningSecret || null,
        slackAllowedUserIds: slackAllowedUserIds || null,
        googleCalendarId: googleCalendarId || null,
      });
      if (result.settings.slackInboundToken) {
        setSlackInboundToken(result.settings.slackInboundToken);
      }
      setGoogleConnected(result.settings.googleConnected);
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

  const handleGoogleConnect = async () => {
    if (!token) return;
    setGoogleLoading(true);
    setError('');
    try {
      const { url } = await settingsService.getGoogleAuthUrl(token);
      window.location.href = url;
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError('Failed to start Google authorization');
      }
      setGoogleLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!token) return;
    setGoogleLoading(true);
    setError('');
    try {
      await settingsService.disconnectGoogle(token);
      setGoogleConnected(false);
      setGoogleCalendarId('');
      setSuccess('Google Calendar disconnected.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError('Failed to disconnect Google Calendar');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const webhookUrl = slackInboundToken
    ? `${window.location.origin}/slack/events/${slackInboundToken}`
    : null;

  const handleCopyUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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

      {/* Slack 通知（アウトバウンド） */}

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

      {/* Google カレンダー連携 */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-1">
          Google Calendar
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Connect your Google account to let Hermes create calendar events automatically.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {googleConnected ? (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-gray-700">Connected</span>
                </>
              ) : (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
                  <span className="text-sm font-medium text-gray-500">Not connected</span>
                </>
              )}
            </div>
            {googleConnected ? (
              <button
                type="button"
                onClick={handleGoogleDisconnect}
                disabled={googleLoading}
                className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoogleConnect}
                disabled={googleLoading}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {googleLoading ? 'Connecting...' : 'Connect with Google'}
              </button>
            )}
          </div>

          {googleConnected && (
            <div>
              <label htmlFor="googleCalendarId" className="block text-sm font-medium text-gray-700">
                Calendar ID
              </label>
              <input
                type="text"
                id="googleCalendarId"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="primary"
                value={googleCalendarId}
                onChange={(e) => setGoogleCalendarId(e.target.value)}
              />
              <p className="mt-1 text-sm text-gray-500">
                Leave blank to use your primary calendar. You can find Calendar IDs in Google Calendar settings.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Slack インバウンド（受信） */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-1">
          Slack Inbound
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Receive and process Slack DMs or mentions with Hermes.
          Only messages from allowed User IDs will be processed.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="slackBotToken" className="block text-sm font-medium text-gray-700">
              Bot User OAuth Token
            </label>
            <input
              type="password"
              id="slackBotToken"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="xoxb-..."
              value={slackBotToken}
              onChange={(e) => setSlackBotToken(e.target.value)}
            />
            <p className="mt-1 text-sm text-gray-500">
              From OAuth &amp; Permissions in your Slack App settings. Required for replying.
            </p>
          </div>

          <div>
            <label htmlFor="slackSigningSecret" className="block text-sm font-medium text-gray-700">
              Signing Secret
            </label>
            <input
              type="password"
              id="slackSigningSecret"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={slackSigningSecret}
              onChange={(e) => setSlackSigningSecret(e.target.value)}
            />
            <p className="mt-1 text-sm text-gray-500">
              From Basic Information in your Slack App. Used to verify webhook requests.
            </p>
          </div>

          <div>
            <label htmlFor="slackAllowedUserIds" className="block text-sm font-medium text-gray-700">
              Allowed Slack User IDs
            </label>
            <input
              type="text"
              id="slackAllowedUserIds"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="U1234XXXXX, U9876YYYYY"
              value={slackAllowedUserIds}
              onChange={(e) => setSlackAllowedUserIds(e.target.value)}
            />
            <p className="mt-1 text-sm text-gray-500">
              Comma-separated Slack User IDs allowed to trigger Hermes. Leave empty to allow all workspace members.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Webhook URL
            </label>
            {webhookUrl ? (
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 block w-full border border-gray-300 rounded-l-md py-2 px-3 bg-gray-50 text-sm text-gray-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ) : (
              <p className="mt-1 text-sm text-gray-500 italic">
                Save your Signing Secret to generate the webhook URL.
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Set this URL as the Request URL in Slack App &gt; Event Subscriptions.
            </p>
          </div>
        </div>
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
