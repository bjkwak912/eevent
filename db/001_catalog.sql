CREATE TABLE IF NOT EXISTS catalog_versions (
  revision integer PRIMARY KEY CHECK (revision > 0),
  fingerprint text NOT NULL,
  catalog jsonb NOT NULL,
  review_note text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);
-- statement-break
CREATE TABLE IF NOT EXISTS catalog_current (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision integer REFERENCES catalog_versions(revision)
);
-- statement-break
INSERT INTO catalog_current(singleton, revision) VALUES(true, null) ON CONFLICT DO NOTHING;
-- statement-break
CREATE TABLE IF NOT EXISTS source_observations (
  source_url text PRIMARY KEY,
  content_hash text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);
-- statement-break
CREATE TABLE IF NOT EXISTS check_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL,
  details jsonb NOT NULL
);
-- statement-break
CREATE OR REPLACE FUNCTION publish_catalog(candidate jsonb, content_fingerprint text, expected_revision integer, note text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE current_revision integer; current_fingerprint text; next_revision integer;
BEGIN
  SELECT revision INTO current_revision FROM catalog_current WHERE singleton=true FOR UPDATE;
  SELECT fingerprint INTO current_fingerprint FROM catalog_versions WHERE revision=current_revision;
  IF current_fingerprint=content_fingerprint THEN
    INSERT INTO check_runs(result,details) VALUES('REVIEWED_UNCHANGED',jsonb_build_object('revision',current_revision,'note',note));
    RETURN jsonb_build_object('published',false,'revision',current_revision);
  END IF;
  IF coalesce(current_revision,0)<>expected_revision THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
  next_revision:=coalesce(current_revision,0)+1;
  -- The first migration may preserve an existing, previously published local revision.
  IF current_revision IS NULL THEN next_revision:=greatest(1,(candidate->>'revision')::integer); END IF;
  candidate:=jsonb_set(candidate,'{revision}',to_jsonb(next_revision));
  INSERT INTO catalog_versions(revision,fingerprint,catalog,review_note) VALUES(next_revision,content_fingerprint,candidate,note);
  UPDATE catalog_current SET revision=next_revision WHERE singleton=true;
  INSERT INTO check_runs(result,details) VALUES('REVIEWED_PUBLISHED',jsonb_build_object('revision',next_revision,'note',note));
  RETURN jsonb_build_object('published',true,'revision',next_revision);
END $$;
