-- Add is_pinned column to report_widgets table
ALTER TABLE report_widgets ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
