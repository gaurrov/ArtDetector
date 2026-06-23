/*
# Create detection_history table (multi-user, owner-scoped)

1. New Tables
- `detection_history`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to authenticated user - owner)
  - `media_type` (text: 'image' or 'video')
  - `file_name` (text, the uploaded file's name)
  - `file_url` (text, optional - where the media is stored/referenced)
  - `predicted_class` (text, the model's top prediction)
  - `confidence` (numeric, 0-100, the top-class confidence percentage)
  - `class_breakdown` (jsonb, array of {label, probability} for all classes)
  - `created_at` (timestamptz, defaults to now)

2. Security
- Enable RLS on `detection_history`.
- Owner-scoped CRUD: each authenticated user can only access their own detection history rows.
- 4 separate policies (select/insert/update/delete), all restricted to `authenticated`.
*/

CREATE TABLE IF NOT EXISTS detection_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  file_name text NOT NULL,
  file_url text,
  predicted_class text NOT NULL,
  confidence numeric(6,2) NOT NULL,
  class_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE detection_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_detection_history" ON detection_history;
CREATE POLICY "select_own_detection_history"
  ON detection_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_detection_history" ON detection_history;
CREATE POLICY "insert_own_detection_history"
  ON detection_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_detection_history" ON detection_history;
CREATE POLICY "update_own_detection_history"
  ON detection_history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_detection_history" ON detection_history;
CREATE POLICY "delete_own_detection_history"
  ON detection_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS detection_history_user_id_created_at_idx
  ON detection_history (user_id, created_at DESC);
