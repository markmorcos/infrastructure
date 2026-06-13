-- Backfill repo (and namespace where a live K8s namespace exists) for known
-- projects. Idempotent: WHERE repo IS NULL, so it never clobbers values set
-- later via the UI. Projects without a current namespace get repo only.
UPDATE projects p
SET repo = v.repo, namespace = v.namespace
FROM (VALUES
  ('booking',              'markmorcos/booking',          NULL::text),
  ('cms',                  'markmorcos/infrastructure',   'cms'),
  ('datewithmark',         'markmorcos/datewithmark',     'datewithmark'),
  ('essenteil',            'markmorcos/essenteil',        NULL),
  ('eventlane',            'markmorcos/eventlane',        'eventlane'),
  ('experimentation',      'markmorcos/infrastructure',   'experimentation'),
  ('games',                'markmorcos/games',            'games'),
  ('infrastructure-admin', 'markmorcos/infrastructure',   'infrastructure-admin'),
  ('lea',                  'markmorcos/Lea',              'lea'),
  ('ma3ady',               'markmorcos/ma3ady',           'ma3ady'),
  ('naharda',              'markmorcos/naharda',          'naharda'),
  ('pile',                 'markmorcos/pile',             'pile'),
  ('portfolio',            'markmorcos/portfolio',        'portfolio'),
  ('scrum-poker',          'markmorcos/scrum_poker',      NULL),
  ('secrets',              'markmorcos/secrets',          'secrets'),
  ('snippets',             'markmorcos/snippets',         NULL),
  ('stminaconnect',        'markmorcos/stminaconnect',    'stminaconnect'),
  ('tazaker',              'markmorcos/Tazaker',          NULL),
  ('urbansportsclub',      'markmorcos/urbansportsclub',  NULL),
  ('url-shortner',         'markmorcos/url-shortener',    NULL),
  ('watch',                'markmorcos/watch',            NULL),
  ('whiteboard',           'markmorcos/whiteboard',       NULL)
) AS v(project_name, repo, namespace)
WHERE p.project_name = v.project_name AND p.repo IS NULL;
