import gspread
from google.oauth2.service_account import Credentials
import pandas as pd
import logging
from datetime import datetime, timedelta
import logging
import os
from pytz import timezone

class GoogleSheetsClient:
    def __init__(self, credentials_file="gcp-creds.json", sheet_name="Merlin 2.0"):
        """Initialize Google Sheets client"""
        self.credentials_file = credentials_file
        self.sheet_name = sheet_name
        self.worksheet_name = "Merged Data"  # Main worksheet name
        self.client = None
        self.sheet = None
        self.worksheet = None
        
        # Initialize connection
        self._init_connection()
    
    def _init_connection(self):
        """Initialize connection to Google Sheets"""
        try:
            scopes = [
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive"
            ]
            
            if not os.path.exists(self.credentials_file):
                logging.error(f"Credentials file not found: {self.credentials_file}")
                return False
            
            creds = Credentials.from_service_account_file(self.credentials_file, scopes=scopes)
            self.client = gspread.authorize(creds)
            
            # Open or create the sheet
            try:
                self.sheet = self.client.open(self.sheet_name)
            except gspread.SpreadsheetNotFound:
                logging.warning(f"Sheet '{self.sheet_name}' not found. Creating new sheet...")
                self.sheet = self.client.create(self.sheet_name)
            
            # Get or create the worksheet
            try:
                self.worksheet = self.sheet.worksheet(self.worksheet_name)
            except gspread.exceptions.WorksheetNotFound:
                logging.warning(f"Worksheet '{self.worksheet_name}' not found. Creating new worksheet...")
                self.worksheet = self.sheet.add_worksheet(title=self.worksheet_name, rows="1000", cols="30")
            
            logging.info("Google Sheets connection established successfully")
            return True
            
        except Exception as e:
            logging.error(f"Failed to initialize Google Sheets connection: {str(e)}")
            return False
    
    def get_all_data(self):
        """Get all data from the worksheet with better error handling"""
        try:
            if not self.worksheet:
                self._init_connection()
            
            # Method 1: Try get_all_records first
            try:
                data = self.worksheet.get_all_records()
                if data:
                    logging.info(f"Retrieved {len(data)} records using get_all_records()")
                    return data
            except Exception as e:
                logging.warning(f"get_all_records() failed: {e}")
            
            # Method 2: Fallback to manual conversion
            try:
                all_values = self.worksheet.get_all_values()
                if not all_values or len(all_values) < 2:
                    logging.warning("No data found in worksheet")
                    return []
                
                headers = all_values[0]
                rows = all_values[1:]
                
                data = []
                for row in rows:
                    # Skip completely empty rows
                    if not any(cell.strip() for cell in row if cell):
                        continue
                    
                    # Pad row with empty strings if shorter than headers
                    while len(row) < len(headers):
                        row.append('')
                    
                    # Create record
                    record = dict(zip(headers, row))
                    data.append(record)
                
                logging.info(f"Retrieved {len(data)} records using manual conversion")
                return data
                
            except Exception as e:
                logging.error(f"Manual conversion failed: {e}")
                return []
            
        except Exception as e:
            logging.error(f"Error getting all data: {str(e)}")
            return []
    
    def get_flight_numbers(self, query="", limit=50):
        """Get flight numbers for autocomplete with improved sorting"""
        try:
            data = self.get_all_data()
            if not data:
                return []
            
            flight_numbers = set()  # Use set to avoid duplicates
            for row in data:
                # Try different possible column names for flight number
                flt_no = None
                for col_name in ['FLT NO', 'Flight', 'FLIGHT', 'Flight Number', 'FLT_NO']:
                    if col_name in row:
                        flt_no = str(row.get(col_name, '')).strip().upper()
                        break
                
                if flt_no and (not query or query.upper() in flt_no):
                    flight_numbers.add(flt_no)
            
            # Convert to list and sort with query relevance
            flight_list = list(flight_numbers)
            if query:
                query_upper = query.upper()
                # Sort by relevance: exact matches first, then starts with, then contains
                flight_list.sort(key=lambda x: (
                    0 if x == query_upper else
                    1 if x.startswith(query_upper) else
                    2 if query_upper in x else 3,
                    x  # Then alphabetically
                ))
            else:
                flight_list.sort()
            
            return flight_list[:limit]
            
        except Exception as e:
            logging.error(f"Error getting flight numbers: {str(e)}")
            return []
    
    def get_mawb_numbers(self, flight_number="", query="", limit=50):
        """Get MAWB numbers for autocomplete, optionally filtered by flight number"""
        try:
            data = self.get_all_data()
            if not data:
                return []
            
            mawb_numbers = set()  # Use set to avoid duplicates
            for row in data:
                # Get MAWB value
                mawb = None
                for col_name in ['MAWB', 'HAWB', 'AWB']:
                    if col_name in row:
                        mawb = str(row.get(col_name, '')).strip().upper()
                        break
                
                if not mawb:
                    continue
                
                # Get flight number for this row
                row_flight = None
                for col_name in ['FLT NO', 'Flight', 'FLIGHT', 'Flight Number', 'FLT_NO']:
                    if col_name in row:
                        row_flight = str(row.get(col_name, '')).strip().upper()
                        break
                
                # Filter by flight number if provided
                if flight_number:
                    flight_upper = flight_number.upper()
                    if not row_flight or row_flight != flight_upper:
                        continue
                
                # Filter by query if provided
                if query:
                    query_upper = query.upper()
                    if query_upper not in mawb:
                        continue
                
                mawb_numbers.add(mawb)
            
            # Convert to list and sort with query relevance
            mawb_list = list(mawb_numbers)
            if query:
                query_upper = query.upper()
                # Sort by relevance: exact matches first, then starts with, then contains
                mawb_list.sort(key=lambda x: (
                    0 if x == query_upper else
                    1 if x.startswith(query_upper) else
                    2 if query_upper in x else 3,
                    x  # Then alphabetically
                ))
            else:
                mawb_list.sort()
            
            logging.info(f"Found {len(mawb_list)} MAWBs for flight '{flight_number}', query '{query}'")
            return mawb_list[:limit]
            
        except Exception as e:
            logging.error(f"Error getting MAWB numbers: {str(e)}")
            return []
    
    def get_suggestions(self, column, query="", flight="", limit=50):
        """Enhanced get suggestions with flight filtering for MAWB"""
        try:
            data = self.get_all_data()
            if not data:
                logging.warning("No data available for suggestions")
                return []
            
            # Handle column name variations
            available_columns = list(data[0].keys()) if data else []
            actual_column = None
            
            # Try exact match first
            if column in available_columns:
                actual_column = column
            else:
                # Try case-insensitive match and common variations
                column_mappings = {
                    'FLIGHT': ['FLT NO', 'Flight', 'FLIGHT', 'Flight Number', 'FLT_NO'],
                    'FLT NO': ['FLT NO', 'Flight', 'FLIGHT', 'Flight Number', 'FLT_NO'],
                    'MAWB': ['MAWB', 'HAWB', 'AWB'],
                    'AWB': ['MAWB', 'HAWB', 'AWB']
                }
                
                search_columns = column_mappings.get(column.upper(), [column])
                for search_col in search_columns:
                    if search_col in available_columns:
                        actual_column = search_col
                        break
            
            if not actual_column:
                logging.warning(f"Column '{column}' not found. Available: {available_columns}")
                return []
            
            # Handle specific column types with enhanced logic
            if actual_column.upper() in ['FLIGHT', 'FLT NO', 'FLT_NO']:
                return self.get_flight_numbers(query, limit)
            elif actual_column.upper() in ['MAWB', 'HAWB', 'AWB']:
                return self.get_mawb_numbers(flight, query, limit)
            
            # Generic suggestions for other columns
            suggestions = set()
            for row in data:
                value = str(row.get(actual_column, '')).strip()
                if value and (not query or query.upper() in value.upper()):
                    suggestions.add(value)
            
            suggestions_list = list(suggestions)
            if query:
                query_upper = query.upper()
                suggestions_list.sort(key=lambda x: (
                    0 if x.upper() == query_upper else
                    1 if x.upper().startswith(query_upper) else
                    2 if query_upper in x.upper() else 3,
                    x
                ))
            else:
                suggestions_list.sort()
            
            return suggestions_list[:limit]
            
        except Exception as e:
            logging.error(f"Error getting suggestions for {column}: {str(e)}")
            return []
    
    def validate_flight(self, flight):
        """Validate flight number based on column names provided."""
        try:
            data = self.get_all_data()
            if not data:
                return {'success': False, 'message': 'No data available'}

            # Filter rows matching the flight number
            matching_rows = [row for row in data if str(row.get('FLT NO', '')).strip() == flight]

            if matching_rows:
                # Extract relevant details from the first matching row
                flight_data = {
                    'flight_number': flight,
                    'origin': matching_rows[0].get('ORIGIN', '-'),
                    'destination': matching_rows[0].get('DEST', '-'),
                    'ata': matching_rows[0].get('ATA', '-'),
                    'bt_arr': matching_rows[0].get('BT ARR', '-')
                }
                return {'success': True, 'flight_data': flight_data}
            else:
                return {'success': False, 'message': f'Flight {flight} not found'}

        except Exception as e:
            logging.error(f"Error validating flight {flight}: {str(e)}")
            return {'success': False, 'message': f'Error validating flight: {str(e)}'}
    
    def validate_mawb(self, mawb):
        """Validate MAWB number based on column names provided."""
        try:
            data = self.get_all_data()
            if not data:
                return {'success': False, 'message': 'No data available'}

            # Filter rows matching the MAWB number
            matching_rows = [row for row in data if str(row.get('MAWB', '')).strip() == mawb]

            if matching_rows:
                # Extract relevant details from the first matching row
                mawb_data = {
                    'mawb': mawb,
                    'flight_number': matching_rows[0].get('FLT NO', '-'),
                    'pieces': matching_rows[0].get('B/BULK', '-'),
                    'weight': matching_rows[0].get('BT NUMBER', '-'),
                    'status': 'Delivered' if matching_rows[0].get('BT ARR', '-') != '-' else 'In Transit'
                }
                return {'success': True, 'mawb_data': mawb_data}
            else:
                return {'success': False, 'message': f'MAWB {mawb} not found'}

        except Exception as e:
            logging.error(f"Error validating MAWB {mawb}: {str(e)}")
            return {'success': False, 'message': f'Error validating MAWB: {str(e)}'}
    
    def find_row_by_mawb(self, mawb):
        """Find row number by MAWB with better column detection"""
        try:
            if not self.worksheet:
                self._init_connection()
            
            # Get headers to find MAWB column
            headers = self.worksheet.row_values(1)
            mawb_col = None
            
            # Find MAWB column
            for i, header in enumerate(headers):
                if header.upper() in ['MAWB', 'HAWB', 'AWB']:
                    mawb_col = i + 1  # Convert to 1-based
                    break
            
            if not mawb_col:
                logging.error("MAWB column not found in headers")
                return None
            
            # Get all values in MAWB column
            mawb_values = self.worksheet.col_values(mawb_col)
            
            for i, value in enumerate(mawb_values):
                if str(value).strip().upper() == str(mawb).strip().upper():
                    return i + 1  # Return 1-based row number
            
            return None
            
        except Exception as e:
            logging.error(f"Error finding row for MAWB {mawb}: {str(e)}")
            return None
    
    def update_ramp_data(self, mawb, received_pieces, employee_id):
        """Update received pieces for a MAWB"""
        try:
            if not self.worksheet:
                if not self._init_connection():
                    return {'success': False, 'message': 'Failed to connect to Google Sheets'}
            
            row_num = self.find_row_by_mawb(mawb)
            if not row_num:
                return {'success': False, 'message': f'MAWB {mawb} not found in sheet'}
            
            # Find RCVD PCS column
            headers = self.worksheet.row_values(1)
            rcvd_col = None
            for i, header in enumerate(headers):
                if 'RCVD' in header.upper() and 'PCS' in header.upper():
                    rcvd_col = i + 1
                    break
            
            if not rcvd_col:
                return {'success': False, 'message': 'RCVD PCS column not found'}
            
            # Update RCVD PCS column
            self.worksheet.update_cell(row_num, rcvd_col, int(received_pieces))
            
            # Optional: Update timestamp
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            logging.info(f"Updated MAWB {mawb} received pieces to {received_pieces} by {employee_id}")
            
            return {'success': True, 'message': f'Updated received pieces for MAWB {mawb}'}
            
        except Exception as e:
            logging.error(f"Error updating ramp data for MAWB {mawb}: {str(e)}")
            return {'success': False, 'message': f'Failed to update: {str(e)}'}
    
    def update_towing_data(self, flight_number, mawb, bt_number, bt_arrival, employee_id):
        """Update BT number and arrival time for a MAWB with enhanced column detection"""
        try:
            if not self.worksheet:
                if not self._init_connection():
                    return {'success': False, 'message': 'Failed to connect to Google Sheets'}
            
            row_num = self.find_row_by_mawb(mawb)
            if not row_num:
                return {'success': False, 'message': f'MAWB {mawb} not found in sheet'}
            
            # Get headers for column detection
            headers = self.worksheet.row_values(1)
            
            # Find relevant columns
            flight_col = None
            bt_col = None
            bt_arr_col = None
            
            for i, header in enumerate(headers):
                header_upper = header.upper()
                if 'FLT' in header_upper or header_upper in ['FLIGHT', 'FLIGHT NUMBER']:
                    flight_col = i + 1
                elif 'BT' in header_upper and 'NUMBER' in header_upper:
                    bt_col = i + 1
                elif 'BT' in header_upper and ('ARR' in header_upper or 'ARRIVAL' in header_upper):
                    bt_arr_col = i + 1
            
            # Verify flight number matches (optional safety check)
            if flight_col:
                current_flight = self.worksheet.cell(row_num, flight_col).value
                if current_flight and str(current_flight).strip().upper() != str(flight_number).strip().upper():
                    return {'success': False, 'message': f'Flight number mismatch for MAWB {mawb}'}
            
            # Update BT NUMBER column
            if bt_col:
                self.worksheet.update_cell(row_num, bt_col, str(bt_number))
            else:
                logging.warning("BT NUMBER column not found")
            
            # Update BT ARR column if bt_arrival is provided
            if bt_arrival and bt_arr_col:
                try:
                    # Remove 'Z' and parse as naive UTC time, then add 8 hours for Singapore time
                    cleaned_iso = bt_arrival.replace('Z', '')
                    parsed_time = datetime.fromisoformat(cleaned_iso)
                    singapore_time_obj = parsed_time + timedelta(hours=8)
                    arrival_time = singapore_time_obj.strftime('%H%M')
                    self.worksheet.update_cell(row_num, bt_arr_col, arrival_time)
                except Exception as e:
                    logging.error(f"Error processing BT arrival time: {e}")
            
            logging.info(f"Updated MAWB {mawb} BT number to {bt_number} by {employee_id}")
            
            return {'success': True, 'message': f'Updated BT delivery for MAWB {mawb}'}
            
        except Exception as e:
            logging.error(f"Error updating towing data for MAWB {mawb}: {str(e)}")
            return {'success': False, 'message': f'Failed to update: {str(e)}'}
    
    def update_scraped_data(self, mawb, scraped_data, employee_id):
        """Update scraped data for a MAWB (for admin functionality)"""
        try:
            if not self.worksheet:
                if not self._init_connection():
                    return {'success': False, 'message': 'Failed to connect to Google Sheets'}
            
            row_num = self.find_row_by_mawb(mawb)
            if not row_num:
                return {'success': False, 'message': f'MAWB {mawb} not found in sheet'}
            
            # Update scraped data fields as needed
            # This would depend on what data is being scraped
            # Example: Update status, tracking info, etc.
            
            logging.info(f"Updated scraped data for MAWB {mawb} by {employee_id}")
            
            return {'success': True, 'message': f'Updated scraped data for MAWB {mawb}'}
            
        except Exception as e:
            logging.error(f"Error updating scraped data for MAWB {mawb}: {str(e)}")
            return {'success': False, 'message': f'Failed to update: {str(e)}'}
    
    def get_sheet_url(self):
        """Get the URL of the Google Sheet"""
        if self.sheet:
            return self.sheet.url
        return None
    
    def debug_sheet_info(self):
        """Debug method to check sheet status and test flight-MAWB filtering"""
        try:
            if not self.worksheet:
                print("❌ No worksheet connection")
                return
            
            print(f"✅ Sheet: {self.sheet_name}")
            print(f"✅ Worksheet: {self.worksheet_name}")
            print(f"✅ URL: {self.sheet.url}")
            
            # Check dimensions
            row_count = self.worksheet.row_count
            col_count = self.worksheet.col_count
            print(f"📐 Dimensions: {row_count} rows x {col_count} cols")
            
            # Check headers
            try:
                headers = self.worksheet.row_values(1)
                print(f"📋 Headers: {headers}")
            except:
                print("❌ Could not read headers")
            
            # Check data count
            try:
                all_values = self.worksheet.get_all_values()
                print(f"📊 Total rows with data: {len(all_values)}")
            except:
                print("❌ Could not count data rows")
            
            # Test flight-MAWB filtering
            print("\n🧪 Testing flight-MAWB filtering:")
            flights = self.get_flight_numbers("", 5)
            print(f"✈️ Sample flights: {flights}")
            
            if flights:
                test_flight = flights[0]
                mawbs = self.get_mawb_numbers(test_flight, "", 5)
                print(f"📦 MAWBs for {test_flight}: {mawbs}")
                
        except Exception as e:
            print(f"❌ Debug failed: {e}")


# Enhanced logging configuration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def test_sheets_connection():
    """Enhanced test function to verify flight-MAWB filtering works"""
    print("🚀 Starting enhanced Google Sheets connection test...\n")
    
    client = GoogleSheetsClient()
    
    # Debug info
    client.debug_sheet_info()
    
    # Test data retrieval
    data = client.get_all_data()
    print(f"\n📊 Retrieved {len(data)} records")
    
    if data:
        print(f"📝 Sample record keys: {list(data[0].keys())}")
        
        # Test flight suggestions
        print("\n🔍 Testing flight suggestions:")
        flight_suggestions = client.get_suggestions('Flight', '')
        print(f"✈️ All flights: {len(flight_suggestions)} found")
        print(f"✈️ First 5 flights: {flight_suggestions[:5]}")
        
        # Test flight-specific MAWB filtering
        if flight_suggestions:
            test_flight = flight_suggestions[0]
            print(f"\n📦 Testing MAWBs for flight {test_flight}:")
            
            # Test 1: Get all MAWBs for specific flight
            flight_mawbs = client.get_suggestions('MAWB', '', test_flight)
            print(f"📦 MAWBs for {test_flight}: {len(flight_mawbs)} found")
            print(f"📦 First 5 MAWBs: {flight_mawbs[:5]}")
            
            # Test 2: Search MAWBs with query for specific flight
            if flight_mawbs:
                # Use first character of first MAWB as query
                test_query = flight_mawbs[0][:2] if flight_mawbs[0] else ""
                if test_query:
                    filtered_mawbs = client.get_suggestions('MAWB', test_query, test_flight)
                    print(f"📦 MAWBs for {test_flight} matching '{test_query}': {filtered_mawbs}")
            
            # Test 3: Validate flight
            flight_validation = client.validate_flight(test_flight)
            print(f"✅ Flight validation: {flight_validation}")
            
            # Test 4: Validate MAWB with flight
            if flight_mawbs:
                test_mawb = flight_mawbs[0]
                mawb_validation = client.validate_mawb(test_mawb, test_flight)
                print(f"✅ MAWB validation: {mawb_validation}")
    
    print(f"\n{'='*50}")
    print(f"🎉 Test completed! Connection successful: {len(data) > 0}")
    return len(data) > 0

# Run the enhanced test
if __name__ == "__main__":
    test_sheets_connection()