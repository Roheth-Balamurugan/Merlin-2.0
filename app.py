import os
import json
import time
import logging
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, Response, flash
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
import pandas as pd
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import our custom modules
from models import db
from database import init_db, get_user_by_employee_id, create_user
from google_sheets_client import GoogleSheetsClient
from scraper_logic import scrape_mawb_data

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///merlin.db")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize the app with the extension
db.init_app(app)

# Create uploads directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize Google Sheets client
sheets_client = GoogleSheetsClient()

with app.app_context():
    # Import models and create tables
    import models
    db.create_all()
    
    # Initialize database with default users if needed
    init_db()

def login_required(f):
    """Decorator to check if user is logged in"""
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

@app.route('/')
def login():
    """Login page"""
    if 'user_id' in session:
        return redirect(url_for('ramp'))
    return render_template('login.html')

@app.route('/ramp')
@login_required
def ramp():
    """Ramp operations page"""
    return render_template('ramp.html')

@app.route('/towing')
@login_required
def towing():
    """Towing operations page"""
    return render_template('towing.html')

@app.route('/admin')
@login_required
def admin():
    """Admin panel page"""
    user = get_user_by_employee_id(session.get('employee_id'))
    if not user or user.team != 'admin':
        flash('Access denied. Admin privileges required.', 'error')
        return redirect(url_for('ramp'))
    return render_template('scraper.html')

# API Endpoints
@app.route('/api/login', methods=['POST'])
def api_login():
    """Login API endpoint"""
    try:
        data = request.get_json()
        employee_id = data.get('employee_id')
        password = data.get('password')
        
        if not employee_id or not password:
            return jsonify({'success': False, 'message': 'Employee ID and password are required'}), 400
        
        user = get_user_by_employee_id(employee_id)
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            session['employee_id'] = user.employee_id
            session['team'] = user.team
            return jsonify({'success': True, 'message': 'Login successful', 'team': user.team})
        else:
            return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
            
    except Exception as e:
        logging.error(f"Login error: {str(e)}")
        return jsonify({'success': False, 'message': 'Login failed'}), 500

@app.route('/api/logout', methods=['POST'])
def api_logout():
    """Logout API endpoint"""
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/api/current_user')
@login_required
def api_current_user():
    """Get current user info"""
    user = get_user_by_employee_id(session.get('employee_id'))
    if user:
        return jsonify({
            'employee_id': user.employee_id,
            'team': user.team
        })
    return jsonify({'error': 'User not found'}), 404

@app.route('/api/start_scrape', methods=['POST'])
@login_required
def api_start_scrape():
    """Start scraping process with uploaded file"""
    try:
        user = get_user_by_employee_id(session.get('employee_id'))
        if not user or user.team != 'admin':
            return jsonify({'success': False, 'message': 'Admin privileges required'}), 403
        
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400
        
        if file and file.filename:
            filename = secure_filename(file.filename)
            if filename.lower().endswith(('.xlsx', '.xls', '.csv')):
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)
                
                # Store filepath in session for streaming
                session['scrape_file'] = filepath
                
                return jsonify({'success': True, 'message': 'File uploaded successfully. Ready to start scraping.'})
            else:
                return jsonify({'success': False, 'message': 'Invalid file format. Please upload Excel or CSV file.'}), 400
        else:
            return jsonify({'success': False, 'message': 'No file selected'}), 400
            
    except Exception as e:
        logging.error(f"File upload error: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to upload file'}), 500

@app.route('/api/stream_scrape_updates')
@login_required
def stream_scrape_updates():
    """Stream scraping updates using Server-Sent Events"""
    def generate():
        try:
            user = get_user_by_employee_id(session.get('employee_id'))
            if not user or user.team != 'admin':
                yield f"data: {json.dumps({'error': 'Admin privileges required'})}\n\n"
                return
            
            filepath = session.get('scrape_file')
            if not filepath or not os.path.exists(filepath):
                yield f"data: {json.dumps({'error': 'No file to process'})}\n\n"
                return
            
            # Read the uploaded file
            if filepath.endswith('.csv'):
                df = pd.read_csv(filepath)
            else:
                df = pd.read_excel(filepath)
            
            # Ensure MAWB column exists
            if 'MAWB' not in df.columns and 'mawb' not in df.columns:
                yield f"data: {json.dumps({'error': 'MAWB column not found in file'})}\n\n"
                return
            
            mawb_column = 'MAWB' if 'MAWB' in df.columns else 'mawb'
            mawbs = df[mawb_column].dropna().astype(str).tolist()
            
            total_mawbs = len(mawbs)
            processed = 0
            
            yield f"data: {json.dumps({'type': 'start', 'total': total_mawbs})}\n\n"
            
            for mawb in mawbs:
                try:
                    # Scrape MAWB data
                    yield f"data: {json.dumps({'type': 'scraping', 'mawb': mawb, 'status': 'Scraping data...'})}\n\n"
                    
                    scrape_result = scrape_mawb_data(mawb)
                    
                    yield f"data: {json.dumps({'type': 'scraped', 'mawb': mawb, 'data': scrape_result})}\n\n"
                    
                    # Update Google Sheets
                    yield f"data: {json.dumps({'type': 'updating', 'mawb': mawb, 'status': 'Updating sheet...'})}\n\n"
                    
                    sheets_result = sheets_client.update_scraped_data(mawb, scrape_result, session.get('employee_id'))
                    
                    if sheets_result['success']:
                        yield f"data: {json.dumps({'type': 'updated', 'mawb': mawb, 'status': 'Sheet updated successfully'})}\n\n"
                    else:
                        error_msg = f"Sheet update failed: {sheets_result['message']}"
                        yield f"data: {json.dumps({'type': 'error', 'mawb': mawb, 'status': error_msg})}\n\n"
                    
                    processed += 1
                    yield f"data: {json.dumps({'type': 'progress', 'processed': processed, 'total': total_mawbs})}\n\n"
                    
                except Exception as e:
                    logging.error(f"Error processing MAWB {mawb}: {str(e)}")
                    yield f"data: {json.dumps({'type': 'error', 'mawb': mawb, 'status': f'Error: {str(e)}'})}\n\n"
                
                # Small delay to prevent overwhelming the server
                time.sleep(0.1)
            
            yield f"data: {json.dumps({'type': 'complete', 'processed': processed, 'total': total_mawbs})}\n\n"
            
            # Clean up uploaded file
            try:
                os.remove(filepath)
                session.pop('scrape_file', None)
            except:
                pass
                
        except Exception as e:
            logging.error(f"Streaming error: {str(e)}")
            yield f"data: {json.dumps({'type': 'error', 'status': f'Streaming error: {str(e)}'})}\n\n"
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/get_flight_numbers', methods=['GET'])
@login_required
def api_get_flight_numbers():
    """Fetch flight numbers for dropdown from Google Sheets"""
    try:
        query = request.args.get('q', '').strip()
        flight_numbers = sheets_client.get_flight_numbers(query)
        return jsonify({'success': True, 'flight_numbers': flight_numbers})
    except Exception as e:
        logging.error(f"Error fetching flight numbers: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to fetch flight numbers', 'flight_numbers': []}), 500

@app.route('/api/get_mawb_numbers', methods=['GET'])
@login_required
def api_get_mawb_numbers():
    """Fetch MAWB numbers for dropdown from Google Sheets"""
    try:
        flight_number = request.args.get('flight_number', '').strip()
        query = request.args.get('q', '').strip()
        
        mawb_numbers = sheets_client.get_mawb_numbers(flight_number, query)
        return jsonify({'success': True, 'mawb_numbers': mawb_numbers})
    except Exception as e:
        logging.error(f"Error fetching MAWB numbers: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to fetch MAWB numbers', 'mawb_numbers': []}), 500

@app.route('/api/get_suggestions')
@login_required
def api_get_suggestions():
    """Get autocomplete suggestions from Google Sheets"""
    try:
        column = request.args.get('column', 'MAWB')
        query = request.args.get('q', '')
        
        suggestions = sheets_client.get_suggestions(column, query)
        return jsonify({'success': True, 'suggestions': suggestions})
        
    except Exception as e:
        logging.error(f"Suggestions error: {str(e)}")
        return jsonify({'success': False, 'suggestions': []})

# NEW: Missing validate_mawb endpoint
@app.route('/api/validate_mawb')
@login_required
def api_validate_mawb():
    """Validate MAWB and return shipment details"""
    try:
        mawb = request.args.get('mawb', '').strip().upper()
        
        if not mawb:
            return jsonify({'success': False, 'message': 'MAWB number is required'})
        
        # Get all data from sheets
        data = sheets_client.get_all_data()
        
        # Find the MAWB
        mawb_data = None
        for row in data:
            if str(row.get('MAWB', '')).strip().upper() == mawb:
                mawb_data = row
                break
        
        if mawb_data:
            # Format the response data
            response_data = {
                'flight_number': mawb_data.get('FLT NO', ''),
                'pieces': mawb_data.get('AWB PCS', ''),
                'weight': mawb_data.get('GW', ''),
                'current_received_pieces': mawb_data.get('RCVD PCS', 0),
                'origin': mawb_data.get('ORIGIN', ''),
                'destination': mawb_data.get('DEST', ''),
                'commodity': mawb_data.get('COMODITY', ''),
            }
            
            return jsonify({
                'success': True,
                'mawb_data': response_data,
                'message': 'MAWB found'
            })
        else:
            return jsonify({
                'success': False,
                'message': f'MAWB {mawb} not found in the system'
            })
            
    except Exception as e:
        logging.error(f"MAWB validation error: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error validating MAWB'
        })

@app.route('/api/update_ramp_data', methods=['POST'])
@login_required
def api_update_ramp_data():
    """Update ramp data in Google Sheets"""
    try:
        data = request.get_json()
        mawb = data.get('mawb', '').strip()
        received_pieces = data.get('received_pieces')
        
        if not mawb or not received_pieces:
            return jsonify({'success': False, 'message': 'MAWB and received pieces are required'}), 400
        
        # Validate received_pieces is a positive integer
        try:
            received_pieces = int(received_pieces)
            if received_pieces <= 0:
                return jsonify({'success': False, 'message': 'Received pieces must be a positive number'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Received pieces must be a valid number'}), 400
        
        # Update Google Sheets
        result = sheets_client.update_ramp_data(mawb, received_pieces, session.get('employee_id'))
        
        if result['success']:
            return jsonify({'success': True, 'message': f'Updated {received_pieces} pieces for MAWB {mawb}'})
        else:
            return jsonify({'success': False, 'message': result['message']}), 400
            
    except Exception as e:
        logging.error(f"Ramp update error: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to update ramp data'}), 500

@app.route('/api/update_towing_data', methods=['POST'])
@login_required
def api_update_towing_data():
    """Update towing data in Google Sheets"""
    try:
        data = request.get_json()
        flight_number = data.get('flight_number', '').strip()
        mawb = data.get('mawb', '').strip()
        bt_number = data.get('bt_number', '').strip()
        bt_arrival = data.get('bt_arrival')  # This should be current timestamp
        
        if not all([flight_number, mawb, bt_number]):
            return jsonify({'success': False, 'message': 'Flight number, MAWB, and BT number are required'}), 400
        
        # Update Google Sheets
        result = sheets_client.update_towing_data(flight_number, mawb, bt_number, bt_arrival, session.get('employee_id'))
        
        if result['success']:
            return jsonify({'success': True, 'message': f'BT {bt_number} delivery recorded for MAWB {mawb}'})
        else:
            return jsonify({'success': False, 'message': result['message']}), 400
            
    except Exception as e:
        logging.error(f"Towing update error: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to update towing data'}), 500

@app.route('/api/sheets_status')
@login_required
def api_sheets_status():
    """Check Google Sheets connection status"""
    try:
        user = get_user_by_employee_id(session.get('employee_id'))
        if not user or user.team != 'admin':
            return jsonify({'success': False, 'message': 'Admin privileges required'}), 403
        
        # Try to get sheet URL and basic info
        sheet_url = sheets_client.get_sheet_url()
        data_count = len(sheets_client.get_all_data())
        
        return jsonify({
            'success': True,
            'connected': True,
            'sheet_url': sheet_url,
            'data_count': data_count,
            'message': f'Connected to Google Sheets with {data_count} records'
        })
        
    except Exception as e:
        logging.error(f"Sheets status check error: {str(e)}")
        return jsonify({
            'success': False,
            'connected': False,
            'message': f'Google Sheets connection failed: {str(e)}'
        }), 500
    
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)