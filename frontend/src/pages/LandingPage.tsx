import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900">Hermes</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              ログイン
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md shadow-sm"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-indigo-50 to-white pt-20 pb-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs font-semibold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
            AIメール・ワークフロー自動化
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
            繰り返しの作業を、<br />
            <span className="text-indigo-600">AIが自動化する</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Hermesはメールの自動処理とスケジュール実行を組み合わせたワークフロー自動化ツールです。
            情報収集・通知・記録など、毎日繰り返す作業をワークフローとして定義するだけで自動化できます。
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="px-8 py-3 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              無料で始める →
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-3 text-base font-semibold text-indigo-600 bg-white border border-indigo-200 hover:border-indigo-400 rounded-lg transition-all"
            >
              使い方を見る
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">できること</h2>
            <p className="mt-3 text-gray-500">Hermesが自動化できる主な機能</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ),
                title: 'メール自動処理',
                description: '専用アドレスに届いたメールをAIが解析し、内容に応じたアクションを自動実行します。',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: 'スケジュール実行',
                description: '毎時・毎日・毎週など柔軟なスケジュールで定期タスクを自動実行します。',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                  </svg>
                ),
                title: 'ツール連携',
                description: 'RSS・URL取得・Hacker News・HTTPリクエストなど多様なデータソースを活用できます。',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                ),
                title: 'Slack / Notion通知',
                description: '処理結果をSlackへ通知、またはNotionデータベースへ自動記録できます。',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex flex-col gap-3 p-6 border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
              >
                <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  {f.icon}
                </div>
                <p className="font-semibold text-gray-900">{f.title}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">活用例</h2>
            <p className="mt-3 text-gray-500">こんな使い方ができます</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                emoji: '📰',
                title: '毎朝ニュースをSlackへ',
                description:
                  'Hacker NewsやRSSフィードの最新情報を毎朝9時に自動取得し、Slackチャンネルへ要約して投稿します。',
                tag: 'スケジュール実行',
              },
              {
                emoji: '📧',
                title: '問い合わせメールを自動分類',
                description:
                  '専用アドレスに届いたメールの内容をAIが判断し、Notionのデータベースへ自動で分類・記録します。',
                tag: 'メール処理',
              },
              {
                emoji: '📊',
                title: '週次レポートを自動送信',
                description:
                  '外部APIからデータを取得し、週次でまとめたレポートをメールやSlackへ自動で配信します。',
                tag: 'スケジュール実行',
              },
              {
                emoji: '🔔',
                title: 'サイト更新を即時通知',
                description:
                  '監視したいURLの内容を定期的に取得し、変化があった場合にSlackへリアルタイム通知します。',
                tag: 'ツール連携',
              },
              {
                emoji: '✅',
                title: 'メールからタスク自動登録',
                description:
                  'メールに書かれたタスクや依頼事項をAIが抽出し、Notionのタスクボードへ自動追加します。',
                tag: 'メール処理',
              },
              {
                emoji: '💹',
                title: '情報収集を一本化',
                description:
                  '複数のRSSフィードやAPIを束ねて毎日サマリーを作成。情報収集のルーティンをまるごと自動化します。',
                tag: 'ツール連携',
              },
            ].map((u) => (
              <div key={u.title} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
                <div className="text-3xl mb-3">{u.emoji}</div>
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {u.tag}
                </span>
                <p className="mt-3 font-semibold text-gray-900">{u.title}</p>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{u.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">使い方</h2>
            <p className="mt-3 text-gray-500">3ステップで自動化を始められます</p>
          </div>
          <div className="space-y-6">
            {[
              {
                number: '1',
                title: 'アカウントを作成する',
                description:
                  'メールアドレスとパスワードを登録するだけで、すぐに利用開始できます。専用のメール受信アドレスが自動で払い出されます。',
              },
              {
                number: '2',
                title: '連携先を設定する',
                description:
                  'SlackのIncoming Webhook URLやNotionのAPIキーを設定ページで登録します。通知先や記録先を簡単に設定できます。',
              },
              {
                number: '3',
                title: 'ワークフローを作成して有効化する',
                description:
                  'タスク名・AIへの指示・使用ツール・実行スケジュールを設定してワークフローを作成します。有効化すれば、あとは自動で動き続けます。',
              },
            ].map((step) => (
              <div key={step.number} className="flex gap-5 p-6 border border-gray-100 rounded-xl shadow-sm">
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-sm">
                  {step.number}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{step.title}</p>
                  <p className="mt-1 text-sm text-gray-500 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 bg-indigo-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white">今すぐ自動化を始めましょう</h2>
          <p className="mt-4 text-indigo-200 text-lg">
            繰り返しの作業をHermesに任せて、本当に重要なことに集中してください。
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="px-8 py-3 text-base font-semibold text-indigo-600 bg-white hover:bg-indigo-50 rounded-lg shadow-md transition-all"
            >
              無料で始める →
            </Link>
            <Link
              to="/login"
              className="px-8 py-3 text-base font-semibold text-white border border-indigo-400 hover:border-white rounded-lg transition-all"
            >
              ログイン
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-500 rounded-md flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-300">Hermes</span>
          </div>
          <p className="text-xs text-gray-500">AIメール・ワークフロー自動化ツール</p>
        </div>
      </footer>
    </div>
  );
}
