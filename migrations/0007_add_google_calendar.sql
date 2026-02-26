-- Google カレンダー連携フィールドを user_settings に追加
ALTER TABLE user_settings ADD COLUMN google_refresh_token TEXT;  -- AES-256-GCM 暗号化済み
ALTER TABLE user_settings ADD COLUMN google_calendar_id TEXT;    -- 例: "primary" または "xxx@group.calendar.google.com"
