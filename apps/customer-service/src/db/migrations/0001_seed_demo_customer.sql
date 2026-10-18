-- Demo data for local development: remove before real use.
INSERT INTO "customers" ("id", "name", "email") VALUES ('00000000-0000-4000-8000-000000000001', 'Demo Customer', 'demo@example.com') ON CONFLICT DO NOTHING;
