// Towing Operations JavaScript with Enhanced Functionality

document.addEventListener('DOMContentLoaded', function() {
    const towingForm = document.getElementById('towingForm');
    
    // Initialize form handler
    if (towingForm) {
        towingForm.addEventListener('submit', handleTowingSubmit);
    }
    
    // Initialize smart inputs with datalist population
    initializeSmartInputs();
    
    // Load initial suggestions
    loadAllSuggestions();
});

async function handleTowingSubmit(event) {
    event.preventDefault();
    
    // Validate form
    if (!MerlinUtils.validateForm('towingForm')) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    // Get form data
    const formData = new FormData(event.target);
    const data = {
        flight_number: formData.get('flight_number').trim().toUpperCase(),
        mawb: formData.get('mawb').trim().toUpperCase(),
        bt_number: formData.get('bt_number').trim().toUpperCase(),
        bt_arrival: new Date().toISOString() // Current timestamp
    };
    
    // Validate data
    if (!data.flight_number || !data.mawb || !data.bt_number) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    // Set loading state
    MerlinUtils.setLoadingState('submitBtn', true);
    
    try {
        const response = await fetch('/api/update_towing_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const timeString = new Date().toLocaleTimeString();
            showAlert(`BT ${data.bt_number} for flight ${data.flight_number} marked as delivered at ${timeString}`, 'success');
            
            // Reset form after successful submission
            event.target.reset();
            
            // Remove validation classes
            const inputs = event.target.querySelectorAll('.form-control');
            inputs.forEach(input => {
                input.classList.remove('is-valid', 'is-invalid');
            });
            
            // Hide any details
            hideFlightDetails();
            hideMawbDetails();
            
            // Focus on first input
            const firstInput = event.target.querySelector('input');
            if (firstInput) {
                firstInput.focus();
            }
            
            // Refresh suggestions to reflect changes
            setTimeout(() => loadAllSuggestions(), 1000);
            
        } else {
            showAlert(result.message || 'Failed to update towing data', 'error');
        }
        
    } catch (error) {
        console.error('Towing update error:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        MerlinUtils.setLoadingState('submitBtn', false);
    }
}

function initializeSmartInputs() {
    const flightInput = document.getElementById('flight_number');
    const mawbInput = document.getElementById('mawb');
    const btInput = document.getElementById('bt_number');
    
    // Flight number input handling
    if (flightInput) {
        let searchTimeout;
        flightInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = this.value.trim();
                if (query.length >= 2) {
                    searchFlightNumbers(query);
                }
            }, 300);
            
            // Clear flight details when input changes
            hideFlightDetails();
            
            // Remove validation classes on input
            if (this.classList.contains('is-invalid') && this.value.trim()) {
                this.classList.remove('is-invalid');
            }
        });
        
        // Validate flight on blur
        flightInput.addEventListener('blur', function() {
            const flight = this.value.trim();
            if (flight) {
                validateFlight(flight);
            }
        });
        
        // Handle flight selection from datalist
        flightInput.addEventListener('change', function() {
            const flight = this.value.trim();
            if (flight) {
                validateFlight(flight);
            }
        });
    }
    
    // MAWB input handling
    if (mawbInput) {
        let searchTimeout;
        mawbInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = this.value.trim();
                if (query.length >= 2) {
                    searchMAWBNumbers(query);
                }
            }, 300);
            
            // Clear MAWB details when input changes
            hideMawbDetails();
            
            // Remove validation classes on input
            if (this.classList.contains('is-invalid') && this.value.trim()) {
                this.classList.remove('is-invalid');
            }
        });
        
        // Validate MAWB on blur
        mawbInput.addEventListener('blur', function() {
            const mawb = this.value.trim();
            if (mawb) {
                validateMAWB(mawb);
            }
        });
        
        // Handle MAWB selection from datalist
        mawbInput.addEventListener('change', function() {
            const mawb = this.value.trim();
            if (mawb) {
                validateMAWB(mawb);
            }
        });
    }
    
    // BT number input validation
    if (btInput) {
        btInput.addEventListener('blur', function() {
            const value = this.value.trim();
            if (value) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            } else {
                this.classList.add('is-invalid');
                this.classList.remove('is-valid');
            }
        });
        
        btInput.addEventListener('input', function() {
            if (this.classList.contains('is-invalid') && this.value.trim()) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            }
        });
    }
}

async function loadAllSuggestions() {
    try {
        await Promise.all([
            populateDatalist('flight_number', 'Flight'),
            populateDatalist('mawb', 'MAWB')
        ]);
    } catch (error) {
        console.error('Error loading suggestions:', error);
    }
}

async function populateDatalist(inputId, column) {
    try {
        const response = await fetch(`/api/get_suggestions?column=${column}&q=`);
        const data = await response.json();
        
        const datalist = document.getElementById(`${inputId}-datalist`);
        if (datalist && data.success && data.suggestions) {
            updateDatalist(datalist, data.suggestions);
        }
    } catch (error) {
        console.error(`Error populating ${column} datalist:`, error);
    }
}

async function searchFlightNumbers(query) {
    try {
        const response = await fetch(`/api/get_suggestions?column=Flight&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        const datalist = document.getElementById('flight_number-datalist');
        if (datalist && data.success && data.suggestions) {
            updateDatalist(datalist, data.suggestions);
        }
    } catch (error) {
        console.error('Error searching flight numbers:', error);
    }
}

async function searchMAWBNumbers(query) {
    try {
        const response = await fetch(`/api/get_suggestions?column=MAWB&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        const datalist = document.getElementById('mawb-datalist');
        if (datalist && data.success && data.suggestions) {
            updateDatalist(datalist, data.suggestions);
        }
    } catch (error) {
        console.error('Error searching MAWB numbers:', error);
    }
}

async function validateFlight(flight) {
    try {
        const response = await fetch(`/api/validate_flight?flight=${encodeURIComponent(flight)}`);
        const result = await response.json();
        
        const flightInput = document.getElementById('flight_number');
        
        if (result.success && result.flight_data) {
            // Flight is valid, show details
            showFlightDetails(result.flight_data);
            flightInput.classList.remove('is-invalid');
            flightInput.classList.add('is-valid');
        } else {
            // Flight is invalid
            hideFlightDetails();
            flightInput.classList.add('is-invalid');
            flightInput.classList.remove('is-valid');
            
            if (result.message) {
                showAlert(result.message, 'warning');
            }
        }
    } catch (error) {
        console.error('Error validating flight:', error);
        showAlert('Error validating flight', 'error');
    }
}

async function validateMAWB(mawb) {
    try {
        const response = await fetch(`/api/validate_mawb?mawb=${encodeURIComponent(mawb)}`);
        const result = await response.json();
        
        const mawbInput = document.getElementById('mawb');
        
        if (result.success && result.mawb_data) {
            // MAWB is valid, show details
            showMawbDetails(result.mawb_data);
            mawbInput.classList.remove('is-invalid');
            mawbInput.classList.add('is-valid');
        } else {
            // MAWB is invalid
            hideMawbDetails();
            mawbInput.classList.add('is-invalid');
            mawbInput.classList.remove('is-valid');
            
            if (result.message) {
                showAlert(result.message, 'warning');
            }
        }
    } catch (error) {
        console.error('Error validating MAWB:', error);
        showAlert('Error validating MAWB', 'error');
    }
}

function showFlightDetails(flightData) {
    const detailsDiv = document.getElementById('flightDetails');
    
    if (detailsDiv) {
        document.getElementById('detailFlightNumber').textContent = flightData.flight_number || '-';
        document.getElementById('detailAircraft').textContent = flightData.aircraft_type || '-';
        document.getElementById('detailOrigin').textContent = flightData.origin || '-';
        document.getElementById('detailETA').textContent = flightData.eta || '-';
        
        detailsDiv.classList.remove('d-none');
        detailsDiv.className = 'alert alert-info mb-3';
    }
}

function hideFlightDetails() {
    const detailsDiv = document.getElementById('flightDetails');
    if (detailsDiv) {
        detailsDiv.classList.add('d-none');
    }
}

function showMawbDetails(mawbData) {
    const detailsDiv = document.getElementById('mawbDetails');
    
    if (detailsDiv) {
        document.getElementById('detailMawbFlight').textContent = mawbData.flight_number || '-';
        document.getElementById('detailMawbPieces').textContent = mawbData.pieces || '-';
        document.getElementById('detailMawbWeight').textContent = mawbData.weight ? `${mawbData.weight} kg` : '-';
        document.getElementById('detailMawbStatus').textContent = mawbData.status || 'Unknown';
        
        detailsDiv.classList.remove('d-none');
        
        // Color code based on status
        if (mawbData.status === 'Delivered') {
            detailsDiv.className = 'alert alert-success mb-3';
        } else if (mawbData.status === 'In Transit') {
            detailsDiv.className = 'alert alert-warning mb-3';
        } else {
            detailsDiv.className = 'alert alert-info mb-3';
        }
    }
}

function hideMawbDetails() {
    const detailsDiv = document.getElementById('mawbDetails');
    if (detailsDiv) {
        detailsDiv.classList.add('d-none');
    }
}

function updateDatalist(datalist, suggestions) {
    datalist.innerHTML = '';
    suggestions.forEach(suggestion => {
        const option = document.createElement('option');
        option.value = suggestion;
        datalist.appendChild(option);
    });
}

async function refreshSuggestions() {
    try {
        showAlert('Refreshing data...', 'info');
        await loadAllSuggestions();
        showAlert('Data refreshed successfully', 'success');
    } catch (error) {
        console.error('Error refreshing suggestions:', error);
        showAlert('Error refreshing data', 'error');
    }
}

// Handle form reset
document.getElementById('towingForm')?.addEventListener('reset', function() {
    // Remove all validation classes
    const inputs = this.querySelectorAll('.form-control');
    inputs.forEach(input => {
        input.classList.remove('is-valid', 'is-invalid');
    });
    
    // Hide details
    hideFlightDetails();
    hideMawbDetails();
    
    // Focus on first input
    const firstInput = this.querySelector('input');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }
});

// Handle input formatting
document.getElementById('flight_number')?.addEventListener('input', function(event) {
    // Convert to uppercase for consistency
    let value = event.target.value.toUpperCase();
    
    // Remove any non-alphanumeric characters except hyphens and spaces
    value = value.replace(/[^A-Z0-9\-\s]/g, '');
    
    // Update the input value
    if (event.target.value !== value) {
        event.target.value = value;
    }
});

document.getElementById('mawb')?.addEventListener('input', function(event) {
    // Convert to uppercase for consistency
    let value = event.target.value.toUpperCase();
    
    // Remove any non-alphanumeric characters except hyphens
    value = value.replace(/[^A-Z0-9\-]/g, '');
    
    // Update the input value
    if (event.target.value !== value) {
        event.target.value = value;
    }
});

document.getElementById('bt_number')?.addEventListener('input', function(event) {
    // Convert to uppercase for consistency
    let value = event.target.value.toUpperCase();
    
    // Remove any non-alphanumeric characters
    value = value.replace(/[^A-Z0-9]/g, '');
    
    // Update the input value
    if (event.target.value !== value) {
        event.target.value = value;
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + Enter to submit form
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn && !submitBtn.disabled) {
            document.getElementById('towingForm')?.dispatchEvent(new Event('submit'));
        }
    }
    
    // Escape to clear form
    if (event.key === 'Escape') {
        const form = document.getElementById('towingForm');
        if (form && confirm('Clear the form?')) {
            form.reset();
            form.dispatchEvent(new Event('reset'));
        }
    }
    
    // F5 to refresh suggestions
    if (event.key === 'F5') {
        event.preventDefault();
        refreshSuggestions();
    }
});

// Auto-complete enhancement for flight number
document.getElementById('flight_number')?.addEventListener('keydown', function(event) {
    if (event.key === 'Tab' || event.key === 'Enter') {
        const datalist = document.getElementById('flight_number-datalist');
        const options = datalist.querySelectorAll('option');
        const currentValue = this.value.toUpperCase();
        
        // Auto-complete with first matching option
        for (let option of options) {
            if (option.value.toUpperCase().startsWith(currentValue)) {
                this.value = option.value;
                break;
            }
        }
    }
});

// Auto-complete enhancement for MAWB
document.getElementById('mawb')?.addEventListener('keydown', function(event) {
    if (event.key === 'Tab' || event.key === 'Enter') {
        const datalist = document.getElementById('mawb-datalist');
        const options = datalist.querySelectorAll('option');
        const currentValue = this.value.toUpperCase();
        
        // Auto-complete with first matching option
        for (let option of options) {
            if (option.value.toUpperCase().startsWith(currentValue)) {
                this.value = option.value;
                break;
            }
        }
    }
});