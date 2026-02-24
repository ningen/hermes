-- Slack インバウンド統合用フィールドを user_settings に追加
ALTER TABLE user_settings ADD COLUMN slack_signing_secret TEXT;    -- 暗号化: Slack App の Signing Secret
ALTER TABLE user_settings ADD COLUMN slack_bot_token TEXT;         -- 暗号化: Bot User OAuth Token (xoxb-...)
ALTER TABLE user_settings ADD COLUMN slack_inbound_token TEXT;     -- 平文: ユーザー固有のWebhookトークン (UUID)
ALTER TABLE user_settings ADD COLUMN slack_allowed_user_ids TEXT;  -- 平文: 許可するSlack User ID (カンマ区切り)
