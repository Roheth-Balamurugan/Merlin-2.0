import logging
import requests
from bs4 import BeautifulSoup
import time
import random
import re
from urllib.parse import urljoin, quote

class MAWBScraper:
    """Web scraper for MAWB tracking information based on AirAsia SmartKargo"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def scrape_airasia_smartkargo(self, mawb):
        """Scrape AirAsia SmartKargo tracking information"""
        results = {
            'mawb': mawb,
            'prefix': '',
            'awb_no': '',
            'status': 'Unknown',
            'origin': 'Unknown',
            'dest': 'Unknown',
            'pcs': 'Unknown',
            'gross_wt': 'Unknown',
            'last_act': 'Unknown',
            'last_act_dt': 'Unknown',
            'do_url': '',
            'carrier': 'AirAsia',
            'error': None
        }
        
        try:
            prefix, awb_no = self._split_mawb(mawb)
            if not prefix or not awb_no:
                results['error'] = 'Invalid MAWB format'
                return results
            
            results['prefix'] = prefix
            results['awb_no'] = awb_no
            
            # Step 1: GET to fetch VIEWSTATE
            initial_url = "https://airasia.smartkargo.com/FrmAWBTracking.aspx"
            response = self.session.get(initial_url, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract viewstate values
            viewstate = soup.find('input', {'name': '__VIEWSTATE'})
            viewstate_gen = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})
            
            if not viewstate or not viewstate_gen:
                results['error'] = 'Could not find required form parameters'
                return results
            
            # Step 2: POST with form data
            form_data = {
                '__VIEWSTATE': viewstate.get('value', ''),
                '__VIEWSTATEGENERATOR': viewstate_gen.get('value', ''),
                'txtPrefix': prefix,
                'TextBoxAWBno': awb_no,
                'ButtonGO': 'Track',
                'ToolkitScriptManager1_HiddenField': ''
            }
            
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': initial_url
            }
            
            post_response = self.session.post(initial_url, data=form_data, headers=headers, timeout=30)
            post_response.raise_for_status()
            
            # Parse tracking results
            tracking_soup = BeautifulSoup(post_response.content, 'html.parser')
            
            # Extract tracking information based on SmartKargo structure
            status_elem = tracking_soup.find('span', {'id': 'lblLatestActivity'})
            if status_elem:
                results['status'] = status_elem.get_text(strip=True)
            
            origin_elem = tracking_soup.find('span', {'id': 'lblOrigin'})
            if origin_elem:
                results['origin'] = origin_elem.get_text(strip=True)
            
            dest_elem = tracking_soup.find('span', {'id': 'lblDestination'})
            if dest_elem:
                results['dest'] = dest_elem.get_text(strip=True)
            
            pcs_elem = tracking_soup.find('span', {'id': 'lblPcs'})
            if pcs_elem:
                results['pcs'] = pcs_elem.get_text(strip=True)
            
            gross_wt_elem = tracking_soup.find('span', {'id': 'lblGrossWt'})
            if gross_wt_elem:
                results['gross_wt'] = gross_wt_elem.get_text(strip=True)
            
            last_act_elem = tracking_soup.find('span', {'id': 'lblLastActivityDescription'})
            if last_act_elem:
                results['last_act'] = last_act_elem.get_text(strip=True)
            
            # Find Delivery Order PDF link
            do_links = tracking_soup.find_all('a', href=True)
            for link in do_links:
                href = link.get('href', '')
                if href.endswith('.pdf'):
                    results['do_url'] = href
                    break
            
            # Be polite to server
            time.sleep(2)
            
        except requests.RequestException as e:
            logging.error(f"Network error scraping MAWB {mawb}: {str(e)}")
            results['error'] = f"Network error: {str(e)}"
        except Exception as e:
            logging.error(f"Error scraping MAWB {mawb}: {str(e)}")
            results['error'] = str(e)
        
        return results
    
    def _split_mawb(self, mawb):
        """Split MAWB into prefix and AWB number"""
        mawb = str(mawb).strip().replace(' ', '')
        
        # Try hyphen-separated format first
        if '-' in mawb:
            parts = mawb.split('-')
            if len(parts) == 2:
                return parts[0], parts[1]
        
        # Try regex pattern for 3-digit prefix + 8-digit number
        pattern = r'(\d{3})[- ]?(\d{8})'
        match = re.match(pattern, mawb)
        if match:
            return match.group(1), match.group(2)
        
        return '', ''
    
    def _scrape_dhl(self, mawb):
        """Scrape DHL tracking information"""
        try:
            url = f"https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id={quote(mawb)}"
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Look for tracking information (this is a simplified example)
            status_element = soup.find('div', class_='status') or soup.find('span', class_='status')
            location_element = soup.find('div', class_='location') or soup.find('span', class_='location')
            
            return {
                'status': status_element.get_text(strip=True) if status_element else 'Unknown',
                'location': location_element.get_text(strip=True) if location_element else 'Unknown',
                'carrier': 'DHL'
            }
            
        except Exception as e:
            logging.debug(f"DHL scraping failed for {mawb}: {str(e)}")
            return None
    
    def _scrape_fedex(self, mawb):
        """Scrape FedEx tracking information"""
        try:
            url = f"https://www.fedex.com/fedextrack/?trknbr={quote(mawb)}"
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Look for tracking information
            status_element = soup.find('div', class_='shipment-status') or soup.find('span', class_='status')
            location_element = soup.find('div', class_='shipment-location') or soup.find('span', class_='location')
            
            return {
                'status': status_element.get_text(strip=True) if status_element else 'Unknown',
                'location': location_element.get_text(strip=True) if location_element else 'Unknown',
                'carrier': 'FedEx'
            }
            
        except Exception as e:
            logging.debug(f"FedEx scraping failed for {mawb}: {str(e)}")
            return None
    
    def _scrape_ups(self, mawb):
        """Scrape UPS tracking information"""
        try:
            url = f"https://www.ups.com/track?loc=en_US&tracknum={quote(mawb)}"
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Look for tracking information
            status_element = soup.find('div', class_='ups-tracking_status') or soup.find('span', class_='status')
            location_element = soup.find('div', class_='ups-tracking_location') or soup.find('span', class_='location')
            
            return {
                'status': status_element.get_text(strip=True) if status_element else 'Unknown',
                'location': location_element.get_text(strip=True) if location_element else 'Unknown',
                'carrier': 'UPS'
            }
            
        except Exception as e:
            logging.debug(f"UPS scraping failed for {mawb}: {str(e)}")
            return None
    
    def _scrape_lufthansa_cargo(self, mawb):
        """Scrape Lufthansa Cargo tracking information"""
        try:
            url = f"https://lufthansa-cargo.com/tracking?awb={quote(mawb)}"
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Look for tracking information
            status_element = soup.find('div', class_='tracking-status') or soup.find('span', class_='status')
            location_element = soup.find('div', class_='tracking-location') or soup.find('span', class_='location')
            
            return {
                'status': status_element.get_text(strip=True) if status_element else 'Unknown',
                'location': location_element.get_text(strip=True) if location_element else 'Unknown',
                'carrier': 'Lufthansa Cargo'
            }
            
        except Exception as e:
            logging.debug(f"Lufthansa Cargo scraping failed for {mawb}: {str(e)}")
            return None

# Global scraper instance
_scraper = MAWBScraper()

def scrape_mawb_data(mawb):
    """Main function to scrape MAWB data using AirAsia SmartKargo"""
    return _scraper.scrape_airasia_smartkargo(mawb)
