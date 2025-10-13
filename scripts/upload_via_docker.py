#!/usr/bin/env python3
import os
import csv
import json
import subprocess
import sys
from pathlib import Path

def process_csv_files():
    print("🚀 Processing CSV files for Docker upload...")

    downloads_dir = Path(__file__).parent / 'downloads'
    csv_files = [f for f in downloads_dir.glob('*.csv') if f.stat().st_size > 1000]

    print(f"📁 Found {len(csv_files)} CSV files to process")

    total_profiles = 0
    all_sql_statements = []

    # Common STR markers
    common_markers = [
        'DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385a', 'DYS385b', 'DYS426', 'DYS388',
        'DYS439', 'DYS389I', 'DYS392', 'DYS389II', 'DYS458', 'DYS459a', 'DYS459b', 'DYS455',
        'DYS454', 'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464a', 'DYS464b', 'DYS464c',
        'DYS464d', 'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607', 'DYS576', 'DYS570',
        'CDY', 'DYS442', 'DYS438', 'DYS531', 'DYS578', 'DYS389i', 'DYS389ii'
    ]

    for csv_file in csv_files:
        print(f"\n📄 Processing {csv_file.name} ({csv_file.stat().st_size / 1024 / 1024:.1f}MB)...")

        uploaded_count = 0
        skipped_count = 0

        try:
            with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
                reader = csv.DictReader(f)

                for row_num, row in enumerate(reader, 1):
                    try:
                        # Extract kit number
                        kit_number = None
                        for field in ['kitNumber', 'kit_number', 'Kit Number', 'Kit', 'KitNumber', 'ID', 'id', '№', 'Номер', 'Sample']:
                            if field in row and row[field] and row[field].strip():
                                kit_number = row[field].strip()
                                break

                        if not kit_number:
                            skipped_count += 1
                            continue

                        # Extract basic info
                        name = ''
                        for field in ['name', 'Name', 'Имя', 'Sample Name']:
                            if field in row and row[field]:
                                name = row[field].strip()
                                break

                        country = ''
                        for field in ['country', 'Country', 'Страна', 'Origin']:
                            if field in row and row[field]:
                                country = row[field].strip()
                                break

                        haplogroup = ''
                        for field in ['haplogroup', 'Haplogroup', 'Гаплогруппа', 'Terminal SNP', 'Y-Haplogroup']:
                            if field in row and row[field]:
                                haplogroup = row[field].strip()
                                break

                        # Extract STR markers
                        markers = {}

                        # Check common markers
                        for marker in common_markers:
                            for field in [marker, marker.lower()]:
                                if field in row and row[field] and row[field].strip() not in ['', '-', 'null']:
                                    markers[marker] = row[field].strip()
                                    break

                        # Check for any DYS columns
                        for field, value in row.items():
                            if field.upper().startswith('DYS') and value and value.strip() not in ['', '-', 'null']:
                                marker_name = field.upper()
                                if marker_name not in markers:
                                    markers[marker_name] = value.strip()

                        if not markers:
                            skipped_count += 1
                            continue

                        # Create SQL statement with proper escaping
                        kit_number_escaped = kit_number.replace("'", "''")
                        name_escaped = name.replace("'", "''")
                        country_escaped = country.replace("'", "''")
                        haplogroup_escaped = haplogroup.replace("'", "''")
                        markers_json = json.dumps(markers).replace("'", "''")

                        sql = f"INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers) VALUES ('{kit_number_escaped}', '{name_escaped}', '{country_escaped}', '{haplogroup_escaped}', '{markers_json}') ON CONFLICT (kit_number) DO NOTHING;"

                        all_sql_statements.append(sql)
                        uploaded_count += 1

                        if uploaded_count % 1000 == 0:
                            print(f"  📊 Processed {uploaded_count} profiles...")

                    except Exception as e:
                        print(f"  ❌ Error processing row {row_num}: {e}")
                        skipped_count += 1

            print(f"✅ {csv_file.name}: {uploaded_count} processed, {skipped_count} skipped")
            total_profiles += uploaded_count

        except Exception as e:
            print(f"❌ Error processing file {csv_file.name}: {e}")

    print(f"\n🎉 Total profiles processed: {total_profiles}")

    # Write SQL to file
    sql_file = Path(__file__).parent / 'upload_data.sql'
    print(f"📝 Writing SQL statements to {sql_file}...")

    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(all_sql_statements))

    print(f"💾 SQL file created with {len(all_sql_statements)} statements")

    # Execute via Docker
    print("🐳 Executing SQL via Docker...")
    try:
        cmd = f'docker exec -i ystr-postgres psql -U postgres -d ystr_matcher -f /dev/stdin < "{sql_file}"'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

        if result.returncode == 0:
            print("✅ SQL executed successfully!")
        else:
            print(f"❌ SQL execution failed: {result.stderr}")
            return False

    except Exception as e:
        print(f"❌ Docker execution error: {e}")
        return False

    # Check final count
    try:
        result = subprocess.run(
            ['docker', 'exec', 'ystr-postgres', 'psql', '-U', 'postgres', '-d', 'ystr_matcher', '-c', 'SELECT COUNT(*) as total FROM ystr_profiles;'],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print(f"📊 Final database count:\n{result.stdout}")
        else:
            print(f"❌ Count check failed: {result.stderr}")
    except Exception as e:
        print(f"❌ Count check error: {e}")

    return True

if __name__ == "__main__":
    success = process_csv_files()
    sys.exit(0 if success else 1)