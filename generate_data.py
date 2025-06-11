#!/usr/bin/env python3
"""
Complete Cargo Digitalization Workflow Data Generator

This script runs the entire workflow to generate simulation data:
1. Flight Schedule (Sheet 1)
2. Cargo Data (Sheet 2)  
3. Merged Google Sheets Plus Data (Final Sheet)

Run this script to generate all the data files needed for your digitalization workflow.
"""

import gspread
from google.oauth2.service_account import Credentials
import pandas as pd
import random
from datetime import datetime, timedelta
import numpy as np
import os

# Set random seed for reproducible results
random.seed(42)
np.random.seed(42)

def generate_flight_schedule(num_flights=50):
    """Generate flight schedule data (Sheet 1)"""
    flight_prefixes = ['AK', 'QZ', 'D7', 'FD', 'Z2', 'XT', 'PX']
    base_date = datetime.now().date()
    flights = []
    
    for i in range(num_flights):
        date_offset = random.randint(0, 6)
        flight_date = base_date + timedelta(days=date_offset)
        hour = random.randint(0, 23)
        minute = random.randint(0, 59)
        ata = f"{hour:02d}{minute:02d}"
        prefix = random.choice(flight_prefixes)
        flight_num = random.randint(100, 9999)
        flt_no = f"{prefix}{flight_num}"
        
        flights.append({
            'DATE': flight_date.strftime('%d-%b-%y'),
            'ATA': ata,
            'FLT NO': flt_no
        })
    
    df = pd.DataFrame(flights)
    return df.sort_values(['DATE', 'ATA']).reset_index(drop=True)

def generate_cargo_data(flight_numbers, num_cargo_records=200):
    """Generate cargo data (Sheet 2)"""
    airports = ['KUL', 'CGK', 'DPS', 'BKK', 'DMK', 'SIN', 'HKG', 'TPE', 'ICN', 
               'NRT', 'BOM', 'DEL', 'CCU', 'MAA', 'PEN', 'KCH', 'BKI', 'MFM',
               'CAN', 'PVG', 'MNL', 'CEB', 'BWN', 'VTE', 'SGN', 'HAN', 'RGN',
               'MDL', 'KNO', 'PLM', 'BTH', 'MLG', 'SOC', 'YIA', 'JOG', 'SBW',
               'SDK', 'TWU', 'AMD', 'MEL', 'PER', 'SYD', 'ADL', 'DRW']
    
    commodities = ['GC', 'AVF', 'COU', 'ELI', 'XPS', 'PIL', 'MAL', 'TEX', 'MED',
                   'ELEC', 'AUTO', 'FURN', 'FOOD', 'CHEM', 'MACH', 'BOOK', 'CLTH']
    
    mawb_prefixes = ['807', '843', '126', '229', '695', '180']
    cargo_records = []
    
    for i in range(num_cargo_records):
        flight_info = random.choice(flight_numbers)
        ata = flight_info['ATA']
        flt_no = flight_info['FLT NO']
        
        prefix = random.choice(mawb_prefixes)
        mawb_num = random.randint(10000000, 99999999)
        mawb = f"{prefix}-{mawb_num}"
        
        origin = random.choice(airports)
        dest_options = [apt for apt in airports if apt != origin]
        dest = random.choice(dest_options)
        
        awb_pcs = random.randint(1, 500)
        base_weight = random.uniform(5, 50)
        gw = round(awb_pcs * base_weight * random.uniform(0.5, 2.0), 1)
        commodity = random.choice(commodities)
        
        cargo_records.append({
            'ATA': ata,
            'MAWB': mawb,
            'ORIGIN': origin,
            'DEST': dest,
            'AWB PCS': awb_pcs,
            'GW': gw,
            'COMODITY': commodity,
            'FLT NO': flt_no
        })
    
    df = pd.DataFrame(cargo_records)
    return df.sort_values(['ATA', 'MAWB']).reset_index(drop=True)

def generate_bt_numbers_and_times():
    """Generate BT (Baggage Trolley) related data"""
    bt_prefixes = ['KUL', 'BT', 'I TG', 'GTR DT', 'PMC']
    bt_nums = []
    
    num_bts = random.randint(1, 4)
    for _ in range(num_bts):
        prefix = random.choice(bt_prefixes)
        num = random.randint(1, 999)
        #emoji = random.choice(['🔜', '🎠', '🍜', '🚜', '✅🚜', ''])
        #bt_nums.append(f"{prefix} {num} {emoji}".strip())
        bt_nums.append(f"{prefix} {num}")
    
    return ' / '.join(bt_nums)

def generate_time_from_ata(ata_str, offset_minutes=0):
    """Generate time based on ATA with offset"""
    try:
        ata_hour = int(ata_str[:2])
        ata_min = int(ata_str[2:])
        
        total_minutes = ata_hour * 60 + ata_min + offset_minutes
        
        if total_minutes >= 1440:
            total_minutes -= 1440
        elif total_minutes < 0:
            total_minutes += 1440
            
        new_hour = total_minutes // 60
        new_min = total_minutes % 60
        
        return f"{new_hour:02d}{new_min:02d}"
    except:
        return ata_str

def merge_flight_cargo_data(flight_df, cargo_df):
    """Merge flight schedule and cargo data into final format"""
    
    # Handle duplicate ATAs by grouping flights by ATA
    ata_to_flights = flight_df.groupby('ATA').apply(lambda x: x.to_dict('records')).to_dict()
    merged_records = []
    
    for idx, cargo in cargo_df.iterrows():
        ata = cargo['ATA']
        
        if ata in ata_to_flights:
            # If multiple flights have same ATA, pick the first one or match by flight number
            available_flights = ata_to_flights[ata]
            # Try to match by flight number first
            matching_flight = None
            for flight in available_flights:
                if flight['FLT NO'] == cargo['FLT NO']:
                    matching_flight = flight
                    break
            
            # If no exact match, use the first available flight
            if matching_flight is None:
                matching_flight = available_flights[0]
            
            flt_no = matching_flight['FLT NO']
            date = matching_flight['DATE']
        else:
            # Fallback: use the flight number from cargo data
            flt_no = cargo['FLT NO']
            # Find a date from flight_df for this flight or use first available
            matching_date_flights = flight_df[flight_df['FLT NO'] == flt_no]
            if not matching_date_flights.empty:
                date = matching_date_flights.iloc[0]['DATE']
            else:
                date = flight_df.iloc[0]['DATE']
        
        bt_arr = generate_time_from_ata(ata, random.randint(30, 90))
        b_bulk = generate_time_from_ata(ata, random.randint(60, 120))
        bt_numbers = generate_bt_numbers_and_times()
        
        checkers = ['GTR8415', 'GTR8416', 'GTR8417', 'GTR8418', 'GTR8419']
        teams = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo']
        
        merged_record = {
            'DATE': date,
            'ATA': ata,
            'BT ARR': bt_arr,
            'B/BULK': b_bulk,
            'MAWB': cargo['MAWB'],
            'BT NUMBER': bt_numbers,
            'FLT NO': flt_no,
            'ORIGIN': cargo['ORIGIN'],
            'DEST': cargo['DEST'],
            'AWB PCS': cargo['AWB PCS'],
            'RCVD PCS': cargo['AWB PCS'],
            'GW': cargo['GW'],
            'CW': cargo['GW'],
            'CHECKER': random.choice(checkers),
            'TEAM': random.choice(teams),
            'COMODITY': cargo['COMODITY'],
            'REMARKS (LATE TOW REASON)': '',
            'REMARKS': '',
            'DO E-POUCH UPLOADED': '',
            'GROUP': '',
            'ATA(F)': '',
            'BB(F)': '',
            'LEADTIME': '',
            'STATUS': '',
            'SECTION': '',
            'BT ARR(F)': '',
            'RAMP LT': '',
            'RAMP STATS': ''
        }
        
        merged_records.append(merged_record)
    
    merged_df = pd.DataFrame(merged_records)
    return merged_df.sort_values(['DATE', 'ATA', 'MAWB']).reset_index(drop=True)


def upload_to_google_sheet(
    df: pd.DataFrame,
    sheet_name: str = "Merlin 2.0",
    worksheet_name: str = "Merged Data",
    creds_file: str = "gcp-creds.json",
    share_with: str = "roheth135@gmail.com",  # Optional: share with your email
    preserve_columns: list = None,  # Optional: preserve these portal-input columns
    key_column: str = "MAWB",  # Optional: column to use for matching during updates
    overwrite: bool = True  # If False, only append new rows
):
    """
    Upload DataFrame to Google Sheet with options to preserve manual edits.

    Args:
        df (pd.DataFrame): Final DataFrame to write.
        sheet_name (str): Name of the target Google Sheet.
        worksheet_name (str): Tab name within the sheet.
        creds_file (str): Path to service account JSON file.
        share_with (str): Optional email to share the sheet with.
        preserve_columns (list): List of column names to preserve from existing sheet.
        key_column (str): Column to match for safe updates.
        overwrite (bool): Whether to clear and re-upload all or append only new.
    """
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]
    creds = Credentials.from_service_account_file(creds_file, scopes=scopes)
    client = gspread.authorize(creds)

    try:
        sheet = client.open(sheet_name)
    except gspread.SpreadsheetNotFound:
        print(f"   → Sheet '{sheet_name}' not found. Creating...")
        sheet = client.create(sheet_name)

    # Optional: share with your own email
    if share_with:
        try:
            sheet.share(share_with, perm_type='user', role='writer')
            print(f"   ✓ Shared sheet with: {share_with}")
        except Exception as e:
            print(f"   ⚠️ Failed to share with {share_with}: {e}")

    try:
        worksheet = sheet.worksheet(worksheet_name)
    except gspread.exceptions.WorksheetNotFound:
        print(f"   → Worksheet '{worksheet_name}' not found. Creating...")
        worksheet = sheet.add_worksheet(title=worksheet_name, rows="1000", cols="30")

    if overwrite:
        print("   → Overwriting worksheet contents...")
        worksheet.clear()
        worksheet.append_row(df.columns.tolist())
        worksheet.append_rows(df.values.tolist())
    else:
        print("   → Appending only new rows...")
        existing = worksheet.get_all_records()
        if not existing:
            worksheet.append_row(df.columns.tolist())
            worksheet.append_rows(df.values.tolist())
        else:
            existing_df = pd.DataFrame(existing)
            if preserve_columns:
                existing_df = existing_df.set_index(key_column)
                df = df.set_index(key_column)
                for col in preserve_columns:
                    if col in df.columns and col in existing_df.columns:
                        df[col] = existing_df[col].combine_first(df[col])
                df = df.reset_index()
            else:
                df = df[~df[key_column].isin(existing_df[key_column])]
            worksheet.append_rows(df.values.tolist())

    print(f"   ✓ Synced with Google Sheet: {sheet.url}")


def main():
    """Main function to run the complete workflow"""
    print("=" * 60)
    print("CARGO DIGITALIZATION WORKFLOW - DATA GENERATOR")
    print("=" * 60)

    # Step 1: Generate Flight Schedule (Sheet 1)
    print("\n1. Generating Flight Schedule Data (Sheet 1)...")
    flight_df = generate_flight_schedule(50)
    flight_df.to_csv('flight_schedule.csv', index=False)
    print(f"   ✓ Generated {len(flight_df)} flight records")
    print(f"   ✓ Saved to: flight_schedule.csv")

    # Step 2: Generate Cargo Data (Sheet 2)
    print("\n2. Generating Cargo Data (Sheet 2)...")
    flight_list = flight_df.to_dict('records')
    cargo_df = generate_cargo_data(flight_list, 200)

    # Save cargo data (without FLT NO for sheet 2)
    cargo_export = cargo_df.drop('FLT NO', axis=1)
    cargo_export.to_csv('cargo_data.csv', index=False)
    print(f"   ✓ Generated {len(cargo_df)} cargo records")
    print(f"   ✓ Saved to: cargo_data.csv")

    # Step 3: Merge Data for Google Sheets Plus
    print("\n3. Generating Merged Data (Google Sheets Plus)...")
    merged_df = merge_flight_cargo_data(flight_df, cargo_df)

    # Define column order for final output
    column_order = [
        'DATE', 'ATA', 'BT ARR', 'B/BULK', 'MAWB', 'BT NUMBER', 'FLT NO',
        'ORIGIN', 'DEST', 'AWB PCS', 'RCVD PCS', 'GW', 'CW', 'CHECKER',
        'TEAM', 'COMODITY', 'REMARKS (LATE TOW REASON)', 'REMARKS',
        'DO E-POUCH UPLOADED', 'GROUP', 'ATA(F)', 'BB(F)', 'LEADTIME',
        'STATUS', 'SECTION', 'BT ARR(F)', 'RAMP LT', 'RAMP STATS'
    ]

    final_df = merged_df[column_order]
    final_df.to_csv('google_sheets_plus_data.csv', index=False)
    print(f"   ✓ Generated {len(final_df)} merged records")
    print(f"   ✓ Saved to: google_sheets_plus_data.csv")

    # ---------- Upload to Google Sheet ----------
    print("\n4. Uploading to Google Sheet...")
    upload_to_google_sheet(final_df)




if __name__ == "__main__":
    main()
