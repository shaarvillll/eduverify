-- Migration: 002_add_ocr_fields_to_student_documents.sql
-- Phase 2B: Local OCR and Text Extraction Metadata Fields
-- Safe and idempotent: extends existing student_documents table without dropping or resetting any data.

ALTER TABLE student_documents 
ADD COLUMN IF NOT EXISTS extracted_text TEXT,
ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ocr_error TEXT,
ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(5,2);
