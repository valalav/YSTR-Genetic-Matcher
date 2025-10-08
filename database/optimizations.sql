-- Additional PostgreSQL optimizations for production
-- This file is loaded after schema.sql during initialization

-- Performance settings for the database
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET max_worker_processes = 8;
ALTER SYSTEM SET max_parallel_workers = 8;
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;

-- Enable pg_stat_statements for query monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create sample data for testing
INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers) VALUES
('39626', 'Test User 1', 'Russia', 'R1a1a1b1a1a3a', '{"DYS393":"13","DYS390":"24","DYS19":"14","DYS391":"11","DYS385a":"14","DYS385b":"14","DYS426":"12","DYS388":"12","DYS439":"13","DYS389I":"13","DYS392":"14","DYS389II":"29","DYS458":"18","DYS459a":"9","DYS459b":"10","DYS455":"11","DYS454":"11","DYS447":"26","DYS437":"14","DYS448":"20","DYS449":"32","DYS464a":"12","DYS464b":"15","DYS464c":"15","DYS464d":"16","DYS460":"12","Y-GATA-H4":"25","YCAII":"20","DYS456":"13","DYS607":"12","DYS576":"11","DYS570":"13","CDY":"11","DYS442":"11","DYS438":"12","DYS531":"12","DYS578":"0"}'),
('39627', 'Test User 2', 'Poland', 'R1a1a1b1a1a3a', '{"DYS393":"13","DYS390":"24","DYS19":"14","DYS391":"10","DYS385a":"14","DYS385b":"14","DYS426":"12","DYS388":"12","DYS439":"13","DYS389I":"13","DYS392":"14","DYS389II":"29","DYS458":"18","DYS459a":"9","DYS459b":"10","DYS455":"11","DYS454":"11","DYS447":"26","DYS437":"14","DYS448":"20","DYS449":"32","DYS464a":"12","DYS464b":"15","DYS464c":"15","DYS464d":"16","DYS460":"12","Y-GATA-H4":"25","YCAII":"20","DYS456":"13","DYS607":"12","DYS576":"11","DYS570":"13","CDY":"11","DYS442":"11","DYS438":"12","DYS531":"12","DYS578":"0"}'),
('39628', 'Test User 3', 'Lithuania', 'R1a1a1b1a1a3a', '{"DYS393":"13","DYS390":"25","DYS19":"14","DYS391":"11","DYS385a":"14","DYS385b":"14","DYS426":"12","DYS388":"12","DYS439":"13","DYS389I":"13","DYS392":"14","DYS389II":"29","DYS458":"18","DYS459a":"9","DYS459b":"10","DYS455":"11","DYS454":"11","DYS447":"26","DYS437":"14","DYS448":"20","DYS449":"32","DYS464a":"12","DYS464b":"15","DYS464c":"15","DYS464d":"16","DYS460":"12","Y-GATA-H4":"25","YCAII":"20","DYS456":"13","DYS607":"12","DYS576":"11","DYS570":"13","CDY":"11","DYS442":"11","DYS438":"12","DYS531":"12","DYS578":"0"}'),
('TEST001', 'Test Sample 1', 'Germany', 'R1b1a2a1a2c1', '{"DYS393":"12","DYS390":"23","DYS19":"14","DYS391":"10","DYS385a":"11","DYS385b":"14","DYS426":"12","DYS388":"13","DYS439":"12","DYS389I":"13","DYS392":"13","DYS389II":"29","DYS458":"17","DYS459a":"8","DYS459b":"10","DYS455":"11","DYS454":"11","DYS447":"25","DYS437":"15","DYS448":"19","DYS449":"30","DYS464a":"13","DYS464b":"13","DYS464c":"17","DYS464d":"17","DYS460":"11","Y-GATA-H4":"11","YCAII":"19","DYS456":"15","DYS607":"15","DYS576":"17","DYS570":"17","CDY":"36","DYS442":"12","DYS438":"10","DYS531":"9","DYS578":"8"}'),
('TEST002', 'Test Sample 2', 'France', 'R1b1a2a1a2c1', '{"DYS393":"12","DYS390":"23","DYS19":"14","DYS391":"11","DYS385a":"11","DYS385b":"14","DYS426":"12","DYS388":"13","DYS439":"12","DYS389I":"13","DYS392":"13","DYS389II":"29","DYS458":"17","DYS459a":"8","DYS459b":"10","DYS455":"11","DYS454":"11","DYS447":"25","DYS437":"15","DYS448":"19","DYS449":"30","DYS464a":"13","DYS464b":"13","DYS464c":"17","DYS464d":"17","DYS460":"11","Y-GATA-H4":"11","YCAII":"19","DYS456":"15","DYS607":"15","DYS576":"17","DYS570":"17","CDY":"36","DYS442":"12","DYS438":"10","DYS531":"9","DYS578":"8"}');

-- Insert sample haplogroups
INSERT INTO haplogroups (haplogroup, parent_haplogroup, level) VALUES
('R', NULL, 0),
('R1', 'R', 1),
('R1a', 'R1', 2),
('R1a1a', 'R1a', 3),
('R1a1a1b', 'R1a1a', 4),
('R1a1a1b1a', 'R1a1a1b', 5),
('R1a1a1b1a1a', 'R1a1a1b1a', 6),
('R1a1a1b1a1a3', 'R1a1a1b1a1a', 7),
('R1a1a1b1a1a3a', 'R1a1a1b1a1a3', 8),
('R1b', 'R1', 2),
('R1b1a', 'R1b', 3),
('R1b1a2', 'R1b1a', 4),
('R1b1a2a1', 'R1b1a2', 5),
('R1b1a2a1a2', 'R1b1a2a1', 6),
('R1b1a2a1a2c', 'R1b1a2a1a2', 7),
('R1b1a2a1a2c1', 'R1b1a2a1a2c', 8);

-- Refresh materialized view
REFRESH MATERIALIZED VIEW marker_statistics;

-- Create index on sample data
REINDEX TABLE ystr_profiles;