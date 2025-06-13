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
    
    def get_flight_numbers(self, query=""):
        """Get flight numbers for autocomplete"""
        try:
            data = self.get_all_data()
            if not data:
                return []
            
            flight_numbers = []
            for row in data:
                flt_no = str(row.get('FLT NO', '')).strip()
                if flt_no and (not query or query.upper() in flt_no.upper()):
                    if flt_no not in flight_numbers:
                        flight_numbers.append(flt_no)
            
            return sorted(flight_numbers)[:20]  # Return top 20 matches
            
        except Exception as e:
            logging.error(f"Error getting flight numbers: {str(e)}")
            return []
    
    def get_mawb_numbers(self, flight_number="", query=""):
        """Get MAWB numbers for autocomplete, optionally filtered by flight number"""
        try:
            data = self.get_all_data()
            if not data:
                return []
            
            mawb_numbers = []
            for row in data:
                mawb = str(row.get('MAWB', '')).strip()
                flt_no = str(row.get('FLT NO', '')).strip()
                
                # Filter by flight number if provided
                if flight_number and flt_no != flight_number:
                    continue
                
                # Filter by query if provided
                if mawb and (not query or query.upper() in mawb.upper()):
                    if mawb not in mawb_numbers:
                        mawb_numbers.append(mawb)
            
            return sorted(mawb_numbers)[:20]  # Return top 20 matches
            
        except Exception as e:
            logging.error(f"Error getting MAWB numbers: {str(e)}")
            return []
    
    def get_suggestions(self, column, query=""):
        """Get autocomplete suggestions with better column handling"""
        try:
            data = self.get_all_data()
            if not data:
                logging.warning("No data available for suggestions")
                return []
            
            # Handle column name variations
            available_columns = list(data[0].keys())
            actual_column = None
            
            # Try exact match first
            if column in available_columns:
                actual_column = column
            else:
                # Try case-insensitive match
                for col in available_columns:
                    if col.upper() == column.upper():
                        actual_column = col
                        break
            
            if not actual_column:
                logging.warning(f"Column '{column}' not found. Available: {available_columns}")
                return []
            
            # Handle specific column types
            if actual_column.upper() in ['FLIGHT', 'FLT NO']:
                return self.get_flight_numbers(query)
            elif actual_column.upper() == 'MAWB':
                return self.get_mawb_numbers(query=query)
            
            # Generic suggestions
            suggestions = []
            for row in data:
                value = str(row.get(actual_column, '')).strip()
                if value and (not query or query.upper() in value.upper()):
                    if value not in suggestions:
                        suggestions.append(value)
            
            return sorted(suggestions)[:20]
            
        except Exception as e:
            logging.error(f"Error getting suggestions for {column}: {str(e)}")
            return []
    
    def find_row_by_mawb(self, mawb):
        """Find row number by MAWB"""
        try:
            if not self.worksheet:
                self._init_connection()
            
            # Get all values in MAWB column (assuming column E based on your sheet structure)
            mawb_values = self.worksheet.col_values(5)  # Column E (MAWB)
            
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
            
            # Update RCVD PCS column (column K based on your structure)
            self.worksheet.update_cell(row_num, 11, int(received_pieces))  # Column K (RCVD PCS)
            
            # Optional: Update timestamp or employee info
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            logging.info(f"Updated MAWB {mawb} received pieces to {received_pieces} by {employee_id}")
            
            return {'success': True, 'message': f'Updated received pieces for MAWB {mawb}'}
            
        except Exception as e:
            logging.error(f"Error updating ramp data for MAWB {mawb}: {str(e)}")
            return {'success': False, 'message': f'Failed to update: {str(e)}'}
    
    def update_towing_data(self, flight_number, mawb, bt_number, bt_arrival, employee_id):
        """Update BT number and arrival time for a MAWB"""
        try:
            if not self.worksheet:
                if not self._init_connection():
                    return {'success': False, 'message': 'Failed to connect to Google Sheets'}
            
            row_num = self.find_row_by_mawb(mawb)
            if not row_num:
                return {'success': False, 'message': f'MAWB {mawb} not found in sheet'}
            
            # Verify flight number matches (optional safety check)
            current_flight = self.worksheet.cell(row_num, 7).value  # Column G (FLT NO)
            if current_flight and str(current_flight).strip() != str(flight_number).strip():
                return {'success': False, 'message': f'Flight number mismatch for MAWB {mawb}'}
            
            # Update BT NUMBER column (column F based on your structure)
            self.worksheet.update_cell(row_num, 6, str(bt_number))  # Column F (BT NUMBER)
            
            # Update BT ARR column if bt_arrival is provided (column C)
            if bt_arrival:
                # Remove 'Z' and parse as naive UTC time, then add 8 hours for Singapore time
                cleaned_iso = bt_arrival.replace('Z', '')
                parsed_time = datetime.fromisoformat(cleaned_iso)
                singapore_time_obj = parsed_time + timedelta(hours=8)
                arrival_time = singapore_time_obj.strftime('%H%M')
                self.worksheet.update_cell(row_num, 3, arrival_time)  # Column C (BT ARR)
            
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
    '''
    def update_bt_arrival(self, mawb, bt_arrival):
        """Update BT ARR column with Singapore time in HHMM format from ISO timestamp"""
        try:
            if not self.worksheet:
                if not self._init_connection():
                    return {'success': False, 'message': 'Failed to connect to Google Sheets'}

            row_num = self.find_row_by_mawb(mawb)
            if not row_num:
                return {'success': False, 'message': f'MAWB {mawb} not found in sheet'}

            # Remove 'Z' and parse as naive UTC time, then add 8 hours
            cleaned_iso = bt_arrival.replace('Z', '')
            parsed_time = datetime.fromisoformat(cleaned_iso)
            singapore_time_obj = parsed_time + timedelta(hours=8)
            singapore_time = singapore_time_obj.strftime('%H%M')

            # Update BT ARR column (column C)
            self.worksheet.update_cell(row_num, 3, singapore_time)

            logging.info(f"Updated BT ARR for MAWB {mawb} to {singapore_time}")
            return {'success': True, 'message': f'Updated BT ARR for MAWB {mawb}'}

        except Exception as e:
            logging.error(f"Error updating BT ARR for MAWB {mawb}: {str(e)}")
            return {'success': False, 'message': f'Failed to update: {str(e)}'}
    '''

    
    def get_sheet_url(self):
        """Get the URL of the Google Sheet"""
        if self.sheet:
            return self.sheet.url
        return None
    
    def debug_sheet_info(self):
        """Debug method to check sheet status"""
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
                
        except Exception as e:
            print(f"❌ Debug failed: {e}")

    import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# 5. Test your connection with this:
def test_sheets_connection():
    """Test function to verify everything works"""
    client = GoogleSheetsClient()
    
    # Debug info
    client.debug_sheet_info()
    
    # Test data retrieval
    data = client.get_all_data()
    print(f"📊 Retrieved {len(data)} records")
    
    if data:
        print(f"📝 Sample record: {data[0]}")
        
        # Test suggestions
        mawb_suggestions = client.get_suggestions('MAWB', '')
        print(f"🔍 MAWB suggestions: {len(mawb_suggestions)}")
        
        flight_suggestions = client.get_suggestions('FLT NO', '')
        print(f"🔍 Flight suggestions: {len(flight_suggestions)}")
    
    return len(data) > 0

# Run this test:
test_sheets_connection()