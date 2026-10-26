-- Migration 005: Seed Synthetic Role-Based Demo Users
-- Safe and idempotent: Inserts synthetic accounts only if they do not already exist.

INSERT INTO users (id, email, password_hash, role, institution_id, full_name, is_active, can_view_documents, created_at, updated_at)
VALUES
    ('USER-INST-001', 'inst1@nitdelhi.ac.in', '$2b$10$fOOIhptZoXNQh7hdcXCDnuB7djK4m3u3ua6lIywBq9DfYX.SAaVzG', 'INSTITUTION_MEMBER', 'DEMO-INST-001', 'Prof. Rajesh Sharma (NIT Delhi Member)', TRUE, TRUE, NOW(), NOW()),
    ('USER-INST-002', 'inst2@mctar.ac.in', '$2b$10$fOOIhptZoXNQh7hdcXCDnuB7djK4m3u3ua6lIywBq9DfYX.SAaVzG', 'INSTITUTION_MEMBER', 'DEMO-INST-002', 'Dr. Sunita Deshmukh (Maharashtra Tech Member)', TRUE, TRUE, NOW(), NOW()),
    ('USER-INST-003', 'inst3@kiats.ac.in', '$2b$10$fOOIhptZoXNQh7hdcXCDnuB7djK4m3u3ua6lIywBq9DfYX.SAaVzG', 'INSTITUTION_MEMBER', 'DEMO-INST-003', 'Prof. Ramesh Gowda (Karnataka Tech Member)', TRUE, TRUE, NOW(), NOW()),
    ('USER-REV-001', 'reviewer@aicte-india.org', '$2b$10$fOOIhptZoXNQh7hdcXCDnuB7djK4m3u3ua6lIywBq9DfYX.SAaVzG', 'REGULATORY_REVIEWER', NULL, 'Dr. Arvind Swaminathan (Regulatory Reviewer)', TRUE, FALSE, NOW(), NOW()),
    ('USER-REV-002', 'reviewer.auth@aicte-india.org', '$2b$10$fOOIhptZoXNQh7hdcXCDnuB7djK4m3u3ua6lIywBq9DfYX.SAaVzG', 'REGULATORY_REVIEWER', NULL, 'Dr. Kavita Nair (Authorized Reviewer)', TRUE, TRUE, NOW(), NOW()),
    ('USER-ADM-001', 'admin@aicte-india.org', '$2b$10$fOOIhptZoXNQh7hdcXCDnuB7djK4m3u3ua6lIywBq9DfYX.SAaVzG', 'SYSTEM_ADMIN', NULL, 'Vikramaditya Verma (System Administrator)', TRUE, FALSE, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
