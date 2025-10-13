#!/usr/bin/env python3
"""
Load DB.csv and aadna.csv into PostgreSQL database
Priority: aadna.csv overwrites DB.csv for duplicate kit numbers
"""

import csv
import json
import psycopg2
from pathlib import Path
import sys

# Database connection
DB_PARAMS = {
    'host': 'localhost',
    'port': 5432,
    'database': 'ystr_matcher',
    'user': 'postgres',
    'password': 'secure_password'
}

# CSV files
DB_CSV = r'c:\_Data\DNA\Projects\DB\NewDB\DB.csv'
AADNA_CSV = r'c:\_Data\DNA\Projects\DB\NewDB\aadna.csv'

def parse_markers(row):
    """Parse marker columns from CSV row into JSON"""
    markers = {}

    # List of all possible marker columns from the CSV
    marker_columns = [
        'DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385', 'DYS426', 'DYS388',
        'DYS439', 'DYS389i', 'DYS392', 'DYS389ii', 'DYS458', 'DYS459', 'DYS455',
        'DYS454', 'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464', 'DYS460',
        'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607', 'DYS576', 'DYS570', 'CDY',
        'DYS442', 'DYS438', 'DYS531', 'DYS578', 'DYF395S1', 'DYS590', 'DYS537',
        'DYS641', 'DYS472', 'DYF406S1', 'DYS511', 'DYS425', 'DYS413', 'DYS557',
        'DYS594', 'DYS436', 'DYS490', 'DYS534', 'DYS450', 'DYS444', 'DYS481',
        'DYS520', 'DYS446', 'DYS617', 'DYS568', 'DYS487', 'DYS572', 'DYS640',
        'DYS492', 'DYS565', 'DYS710', 'DYS485', 'DYS632', 'DYS495', 'DYS540',
        'DYS714', 'DYS716', 'DYS717', 'DYS505', 'DYS556', 'DYS549', 'DYS589',
        'DYS522', 'DYS494', 'DYS533', 'DYS636', 'DYS575', 'DYS638', 'DYS462',
        'DYS452', 'DYS445', 'Y-GATA-A10', 'DYS463', 'DYS441', 'Y-GGAAT-1B07',
        'DYS525', 'DYS712', 'DYS593', 'DYS650', 'DYS532', 'DYS715', 'DYS504',
        'DYS513', 'DYS561', 'DYS552', 'DYS726', 'DYS635', 'DYS587', 'DYS643',
        'DYS497', 'DYS510', 'DYS434', 'DYS461', 'DYS435'
    ]

    for marker in marker_columns:
        value = row.get(marker, '').strip()
        if value and value != '':
            markers[marker] = value

    return markers if markers else None

def load_csv_file(filepath, conn, is_priority=False):
    """Load a CSV file into the database"""
    cursor = conn.cursor()

    print(f"\nLoading {filepath.name}...")
    print(f"   Priority mode: {is_priority}")

    loaded = 0
    skipped = 0
    updated = 0

    try:
        with open(filepath, 'r', encoding='utf-8-sig', errors='ignore') as f:
            # Detect delimiter
            first_line = f.readline()
            delimiter = ';' if ';' in first_line else ','
            f.seek(0)

            reader = csv.DictReader(f, delimiter=delimiter)

            # DEBUG: Print first row column names
            first_row = True

            for row_num, row in enumerate(reader, 1):
                if first_row:
                    print(f"\n   DEBUG: CSV Columns: {list(row.keys())[:10]}")
                    print(f"   DEBUG: First row data: {dict(list(row.items())[:10])}")
                    first_row = False
                try:
                    kit_number = row.get('Kit Number', '').strip()
                    if not kit_number:
                        skipped += 1
                        continue

                    # Truncate kit_number to 50 characters to fit VARCHAR(50)
                    if len(kit_number) > 50:
                        kit_number = kit_number[:50]

                    name = row.get('Name', '').strip() or None
                    # Truncate name to 200 characters
                    if name and len(name) > 200:
                        name = name[:200]

                    country = row.get('Country', '').strip() or None
                    # Truncate country to 100 characters
                    if country and len(country) > 100:
                        country = country[:100]

                    haplogroup = row.get('Haplogroup', '').strip() or None
                    # Truncate haplogroup to 50 characters
                    if haplogroup and len(haplogroup) > 50:
                        haplogroup = haplogroup[:50]

                    markers = parse_markers(row)
                    if not markers:
                        skipped += 1
                        continue

                    markers_json = json.dumps(markers)

                    try:
                        if is_priority:
                            # For aadna.csv: INSERT ... ON CONFLICT UPDATE
                            cursor.execute("""
                                INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers)
                                VALUES (%s, %s, %s, %s, %s)
                                ON CONFLICT (kit_number) DO UPDATE SET
                                    name = EXCLUDED.name,
                                    country = EXCLUDED.country,
                                    haplogroup = EXCLUDED.haplogroup,
                                    markers = EXCLUDED.markers,
                                    updated_at = CURRENT_TIMESTAMP
                            """, (kit_number, name, country, haplogroup, markers_json))

                            if cursor.rowcount == 1:
                                loaded += 1
                            else:
                                updated += 1
                        else:
                            # For DB.csv: INSERT ... ON CONFLICT DO NOTHING
                            cursor.execute("""
                                INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers)
                                VALUES (%s, %s, %s, %s, %s)
                                ON CONFLICT (kit_number) DO NOTHING
                            """, (kit_number, name, country, haplogroup, markers_json))

                            if cursor.rowcount > 0:
                                loaded += 1
                            else:
                                skipped += 1

                    except Exception as e:
                        # Skip this row if INSERT fails
                        conn.rollback()
                        print(f"\n   WARNING: Insert failed on row {row_num}: {e}")
                        skipped += 1

                    if row_num % 1000 == 0:
                        conn.commit()
                        print(f"   Progress: {row_num:,} rows processed, {loaded:,} loaded, {skipped:,} skipped", end='\r')

                except Exception as e:
                    # Skip this row if parsing fails
                    print(f"\n   WARNING: Parse error on row {row_num}: {e}")
                    skipped += 1
                    continue

            conn.commit()
            print(f"\n   Completed: {loaded:,} loaded, {updated:,} updated, {skipped:,} skipped")

    except Exception as e:
        print(f"\n   ERROR loading file: {e}")
        conn.rollback()
        raise

    return loaded, updated, skipped

def main():
    print("Starting database reload from new CSV files...")
    print(f"   DB.csv: {DB_CSV}")
    print(f"   aadna.csv: {AADNA_CSV}")

    # Connect to database
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        print("\nConnected to PostgreSQL database")
    except Exception as e:
        print(f"\nFailed to connect to database: {e}")
        sys.exit(1)

    try:
        # Load DB.csv first (lower priority)
        db_file = Path(DB_CSV)
        if not db_file.exists():
            print(f"ERROR: File not found: {DB_CSV}")
            sys.exit(1)

        db_loaded, db_updated, db_skipped = load_csv_file(db_file, conn, is_priority=False)

        # Load aadna.csv second (higher priority - will overwrite)
        aadna_file = Path(AADNA_CSV)
        if not aadna_file.exists():
            print(f"ERROR: File not found: {AADNA_CSV}")
            sys.exit(1)

        aadna_loaded, aadna_updated, aadna_skipped = load_csv_file(aadna_file, conn, is_priority=True)

        # Show final statistics
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM ystr_profiles")
        total_profiles = cursor.fetchone()[0]

        cursor.execute("""
            SELECT haplogroup, COUNT(*) as count
            FROM ystr_profiles
            WHERE haplogroup IS NOT NULL
            GROUP BY haplogroup
            ORDER BY count DESC
            LIMIT 10
        """)
        top_haplogroups = cursor.fetchall()

        print("\n" + "="*60)
        print("FINAL STATISTICS")
        print("="*60)
        print(f"Total profiles in database: {total_profiles:,}")
        print(f"\nFrom DB.csv: {db_loaded:,} new profiles")
        print(f"From aadna.csv: {aadna_loaded:,} new + {aadna_updated:,} updated")
        print("\nTop 10 haplogroups:")
        for haplo, count in top_haplogroups:
            print(f"  {haplo}: {count:,}")
        print("="*60)

    except Exception as e:
        print(f"\nERROR: {e}")
        sys.exit(1)
    finally:
        conn.close()
        print("\nDatabase connection closed")

if __name__ == '__main__':
    main()
