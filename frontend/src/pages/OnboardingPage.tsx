import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function OnboardingPage() {
  const { user, emailRoute } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      title: 'メール自動処理',
      description:
        'あなた専用のメールアドレスに届いたメールをAIが解析し、内容に応じた自動処理を実行します。',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: 'スケジュール実行',
      description:
        '毎時・毎日・毎週などのスケジュールで自動的にタスクを実行します。定期的な情報収集やレポート送信に活用できます。',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'ツール連携',
      description:
        'RSSフィード、URLコンテンツ取得、HTTPリクエスト、Hacker Newsなど多様なデータソースからの情報収集が可能です。',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
        </svg>
      ),
    },
    {
      title: 'Slack・Notion通知',
      description:
        'AIが処理した結果をSlackへ通知したり、Notionデータベースに自動追記したりすることができます。',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
  ];

  const steps = [
    {
      number: '1',
      title: '設定を行う',
      description: 'SlackのWebhook URLやNotionのAPIキーを設定ページで登録します。通知先が決まったらすぐに始められます。',
      action: { label: '設定ページへ', onClick: () => navigate('/settings') },
    },
    {
      number: '2',
      title: 'ワークフローを作成する',
      description: 'タスク名、AIへの指示（プロンプト）、使用するツール、実行スケジュールを設定してワークフローを作成します。',
      action: { label: 'ワークフローを作成', onClick: () => navigate('/workflows/new') },
    },
    {
      number: '3',
      title: '自動実行を確認する',
      description: 'ワークフローを有効化すると、設定したスケジュールで自動実行が始まります。ワークフロー一覧で最終実行日時を確認できます。',
      action: { label: 'ワークフロー一覧へ', onClick: () => navigate('/workflows') },
    },
  ];

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="text-center py-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {user?.name ? `${user.name}さん、` : ''}Hermesへようこそ
        </h2>
        <p className="mt-3 text-base text-gray-600 max-w-2xl mx-auto">
          HermesはAIを活用したメール・スケジュール自動化ツールです。
          情報収集から通知まで、繰り返しの作業をワークフローとして定義するだけで自動化できます。
        </p>
        {emailRoute && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-indigo-700">
              あなたの専用メールアドレス:{' '}
              <span className="font-medium">{emailRoute.emailAddress}</span>
            </span>
          </div>
        )}
      </div>

      {/* Features */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">できること</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex gap-4 p-4 border border-gray-200 rounded-lg hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                {feature.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{feature.title}</p>
                <p className="mt-1 text-sm text-gray-500">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Getting started steps */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">はじめかた</h3>
        <ol className="space-y-4">
          {steps.map((step) => (
            <li key={step.number} className="flex gap-4 p-4 border border-gray-200 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 text-white text-sm font-bold">
                {step.number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{step.title}</p>
                <p className="mt-1 text-sm text-gray-500">{step.description}</p>
                <button
                  onClick={step.action.onClick}
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {step.action.label} →
                </button>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-200">
        <button
          onClick={() => navigate('/workflows/new')}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          最初のワークフローを作成する
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          設定を確認する
        </button>
      </div>
    </div>
  );
}
