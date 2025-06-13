// Enhanced Towing Operations JavaScript with Improved Flight-MAWB Filtering

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
            
            // Clear MAWB datalist when form is reset
            clearMawbDatalist();
            
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
    
    // Flight number input handling with enhanced search
    if (flightInput) {
        let searchTimeout;
        flightInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value.trim();
            
            // Clear flight details when input changes
            hideFlightDetails();
            
            // Clear MAWB input and suggestions when flight changes
            if (mawbInput) {
                mawbInput.value = '';
                hideMawbDetails();
                clearMawbDatalist();
            }
            
            // Remove validation classes on input
            if (this.classList.contains('is-invalid') && query) {
                this.classList.remove('is-invalid');
            }
            
            // Search for flight numbers with better debouncing
            if (query.length >= 1) {
                searchTimeout = setTimeout(() => {
                    searchFlightNumbers(query);
                }, 150); // Faster response for better UX
            } else {
                // Show all recent flights when input is empty but focused
                searchTimeout = setTimeout(() => {
                    loadRecentFlights();
                }, 200);
            }
        });
        
        // Show recent flights when input is focused and empty
        flightInput.addEventListener('focus', function() {
            const query = this.value.trim();
            if (!query) {
                loadRecentFlights();
            }
        });
        
        // Validate flight on blur and update MAWB suggestions
        flightInput.addEventListener('blur', function() {
            const flight = this.value.trim();
            if (flight) {
                validateFlight(flight);
            }
        });
        
        // Handle flight selection from datalist - KEY ENHANCEMENT
        flightInput.addEventListener('change', function() {
            const flight = this.value.trim();
            if (flight) {
                validateFlight(flight);
                // Update MAWB suggestions immediately when flight is selected
                updateMawbSuggestionsForFlight(flight);
            }
        });
    }
    
    // MAWB input handling with flight-specific filtering - ENHANCED
    if (mawbInput) {
        let searchTimeout;
        mawbInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value.trim();
            const flightNumber = document.getElementById('flight_number')?.value.trim();
            
            // Clear MAWB details when input changes
            hideMawbDetails();
            
            // Remove validation classes on input
            if (this.classList.contains('is-invalid') && query) {
                this.classList.remove('is-invalid');
            }
            
            if (query.length >= 1) {
                searchTimeout = setTimeout(() => {
                    searchMAWBNumbers(query, flightNumber);
                }, 200);
            } else if (flightNumber) {
                // Show all MAWBs for selected flight when input is empty
                searchTimeout = setTimeout(() => {
                    searchMAWBNumbers('', flightNumber);
                }, 200);
            }
        });
        
        // Show flight-specific MAWBs when focused - ENHANCED
        mawbInput.addEventListener('focus', function() {
            const query = this.value.trim();
            const flightNumber = document.getElementById('flight_number')?.value.trim();
            
            if (flightNumber) {
                // Always show flight-specific MAWBs when focused
                searchMAWBNumbers(query, flightNumber);
            } else {
                // If no flight selected, show message
                showAlert('Please select a flight number first', 'info');
                document.getElementById('flight_number')?.focus();
            }
        });
        
        // Validate MAWB on blur
        mawbInput.addEventListener('blur', function() {
            const mawb = this.value.trim();
            const flightNumber = document.getElementById('flight_number')?.value.trim();
            if (mawb) {
                validateMAWB(mawb, flightNumber);
            }
        });
        
        // Handle MAWB selection from datalist
        mawbInput.addEventListener('change', function() {
            const mawb = this.value.trim();
            const flightNumber = document.getElementById('flight_number')?.value.trim();
            if (mawb) {
                validateMAWB(mawb, flightNumber);
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

// NEW FUNCTION: Update MAWB suggestions when flight is selected
async function updateMawbSuggestionsForFlight(flightNumber) {
    try {
        const mawbInput = document.getElementById('mawb');
        if (!mawbInput || !flightNumber) return;
        
        // Clear current MAWB value and show loading state
        mawbInput.value = '';
        mawbInput.placeholder = 'Loading MAWBs for flight...';
        
        // Load MAWBs specific to this flight
        await searchMAWBNumbers('', flightNumber);
        
        // Reset placeholder
        mawbInput.placeholder = 'Enter or scan MAWB number';
        
        // Show info about available MAWBs
        const datalist = document.getElementById('mawb-datalist');
        if (datalist) {
            const optionCount = datalist.querySelectorAll('option').length;
            if (optionCount > 0) {
                showAlert(`${optionCount} MAWBs available for flight ${flightNumber}`, 'info');
            } else {
                showAlert(`No MAWBs found for flight ${flightNumber}`, 'warning');
            }
        }
        
    } catch (error) {
        console.error('Error updating MAWB suggestions for flight:', error);
        document.getElementById('mawb').placeholder = 'Enter or scan MAWB number';
    }
}

// ENHANCED: Clear MAWB datalist
function clearMawbDatalist() {
    const datalist = document.getElementById('mawb-datalist');
    if (datalist) {
        datalist.innerHTML = '';
    }
}

async function loadAllSuggestions() {
    try {
        await Promise.all([
            loadRecentFlights()
            // Don't preload MAWB suggestions - they'll be loaded based on flight selection
        ]);
    } catch (error) {
        console.error('Error loading suggestions:', error);
    }
}

async function loadRecentFlights() {
    try {
        const response = await fetch(`/api/get_suggestions?column=Flight&q=&limit=50`);
        const data = await response.json();
        
        const datalist = document.getElementById('flight_number-datalist');
        if (datalist && data.success && data.suggestions) {
            updateDatalist(datalist, data.suggestions);
        }
    } catch (error) {
        console.error('Error loading recent flights:', error);
    }
}

async function searchFlightNumbers(query) {
    try {
        const response = await fetch(`/api/get_suggestions?column=Flight&q=${encodeURIComponent(query)}&limit=30`);
        const data = await response.json();
        
        const datalist = document.getElementById('flight_number-datalist');
        if (datalist && data.success && data.suggestions) {
            // Sort suggestions by relevance (exact matches first, then partial matches)
            const sortedSuggestions = sortFlightSuggestions(data.suggestions, query);
            updateDatalist(datalist, sortedSuggestions);
        }
    } catch (error) {
        console.error('Error searching flight numbers:', error);
    }
}

// ENHANCED: MAWB search with better flight filtering
async function searchMAWBNumbers(query, flightNumber = '') {
    try {
        let url = `/api/get_suggestions?column=MAWB&q=${encodeURIComponent(query)}&limit=50`;
        if (flightNumber) {
            url += `&flight=${encodeURIComponent(flightNumber)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        const datalist = document.getElementById('mawb-datalist');
        if (datalist && data.success && data.suggestions) {
            // Sort MAWB suggestions by relevance
            const sortedSuggestions = sortMawbSuggestions(data.suggestions, query);
            updateDatalist(datalist, sortedSuggestions);
            
            // Log for debugging
            console.log(`Found ${data.suggestions.length} MAWBs for flight ${flightNumber || 'any'}, query: "${query}"`);
        }
    } catch (error) {
        console.error('Error searching MAWB numbers:', error);
    }
}

// NEW FUNCTION: Sort MAWB suggestions by relevance
function sortMawbSuggestions(suggestions, query) {
    if (!query) return suggestions;
    
    const queryUpper = query.toUpperCase();
    
    return suggestions.sort((a, b) => {
        const aUpper = a.toUpperCase();
        const bUpper = b.toUpperCase();
        
        // Exact matches first
        if (aUpper === queryUpper) return -1;
        if (bUpper === queryUpper) return 1;
        
        // Starts with query
        if (aUpper.startsWith(queryUpper) && !bUpper.startsWith(queryUpper)) return -1;
        if (bUpper.startsWith(queryUpper) && !aUpper.startsWith(queryUpper)) return 1;
        
        // Contains query
        const aIndex = aUpper.indexOf(queryUpper);
        const bIndex = bUpper.indexOf(queryUpper);
        
        if (aIndex !== -1 && bIndex === -1) return -1;
        if (bIndex !== -1 && aIndex === -1) return 1;
        
        // If both contain query, sort by position
        if (aIndex !== -1 && bIndex !== -1) {
            if (aIndex !== bIndex) return aIndex - bIndex;
        }
        
        // Finally, alphabetical sort
        return aUpper.localeCompare(bUpper);
    });
}

function sortFlightSuggestions(suggestions, query) {
    if (!query) return suggestions;
    
    const queryUpper = query.toUpperCase();
    
    return suggestions.sort((a, b) => {
        const aUpper = a.toUpperCase();
        const bUpper = b.toUpperCase();
        
        // Exact matches first
        if (aUpper === queryUpper) return -1;
        if (bUpper === queryUpper) return 1;
        
        // Starts with query
        if (aUpper.startsWith(queryUpper) && !bUpper.startsWith(queryUpper)) return -1;
        if (bUpper.startsWith(queryUpper) && !aUpper.startsWith(queryUpper)) return 1;
        
        // Contains query (for partial matches)
        const aIndex = aUpper.indexOf(queryUpper);
        const bIndex = bUpper.indexOf(queryUpper);
        
        if (aIndex !== -1 && bIndex === -1) return -1;
        if (bIndex !== -1 && aIndex === -1) return 1;
        
        // If both contain query, sort by position
        if (aIndex !== -1 && bIndex !== -1) {
            if (aIndex !== bIndex) return aIndex - bIndex;
        }
        
        // Finally, alphabetical sort
        return aUpper.localeCompare(bUpper);
    });
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
            
            // Auto-update MAWB suggestions for this flight
            setTimeout(() => {
                updateMawbSuggestionsForFlight(flight);
            }, 300);
        } else {
            // Flight is invalid
            hideFlightDetails();
            flightInput.classList.add('is-invalid');
            flightInput.classList.remove('is-valid');
            
            // Clear MAWB suggestions since flight is invalid
            clearMawbDatalist();
            
            if (result.message) {
                showAlert(result.message, 'warning');
            }
        }
    } catch (error) {
        console.error('Error validating flight:', error);
        showAlert('Error validating flight', 'error');
    }
}

// ENHANCED: MAWB validation with flight verification
async function validateMAWB(mawb, flightNumber = '') {
    try {
        let url = `/api/validate_mawb?mawb=${encodeURIComponent(mawb)}`;
        if (flightNumber) {
            url += `&flight=${encodeURIComponent(flightNumber)}`;
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        const mawbInput = document.getElementById('mawb');
        
        if (result.success && result.mawb_data) {
            // MAWB is valid, show details
            showMawbDetails(result.mawb_data);
            mawbInput.classList.remove('is-invalid');
            mawbInput.classList.add('is-valid');
            
            // Verify flight match if both are provided
            if (flightNumber && result.mawb_data.flight_number && 
                result.mawb_data.flight_number !== flightNumber) {
                showAlert(`Warning: MAWB ${mawb} belongs to flight ${result.mawb_data.flight_number}, not ${flightNumber}`, 'warning');
            }
        } else {
            // MAWB is invalid
            hideMawbDetails();
            mawbInput.classList.add('is-invalid');
            mawbInput.classList.remove('is-valid');
            
            if (result.message) {
                showAlert(result.message, 'warning');
            } else if (flightNumber) {
                showAlert(`MAWB ${mawb} not found for flight ${flightNumber}`, 'warning');
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
    
    // Clear MAWB datalist
    clearMawbDatalist();
    
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

// Enhanced auto-complete for flight number
document.getElementById('flight_number')?.addEventListener('keydown', function(event) {
    if (event.key === 'Tab' || event.key === 'Enter') {
        const datalist = document.getElementById('flight_number-datalist');
        const options = datalist.querySelectorAll('option');
        const currentValue = this.value.toUpperCase();
        
        // Auto-complete with first matching option
        for (let option of options) {
            if (option.value.toUpperCase().startsWith(currentValue)) {
                this.value = option.value;
                // Trigger validation and MAWB update
                setTimeout(() => {
                    validateFlight(option.value);
                    updateMawbSuggestionsForFlight(option.value);
                }, 100);
                break;
            }
        }
    }
});

// Enhanced auto-complete for MAWB
document.getElementById('mawb')?.addEventListener('keydown', function(event) {
    if (event.key === 'Tab' || event.key === 'Enter') {
        const datalist = document.getElementById('mawb-datalist');
        const options = datalist.querySelectorAll('option');
        const currentValue = this.value.toUpperCase();
        const flightNumber = document.getElementById('flight_number')?.value.trim();
        
        // Auto-complete with first matching option
        for (let option of options) {
            if (option.value.toUpperCase().startsWith(currentValue)) {
                this.value = option.value;
                // Trigger validation
                setTimeout(() => validateMAWB(option.value, flightNumber), 100);
                break;
            }
        }
    }
});

// ENHANCED: Monitor flight selection to update MAWB suggestions
document.getElementById('flight_number')?.addEventListener('change', function() {
    const flightNumber = this.value.trim();
    
    if (flightNumber) {
        // Always update MAWB suggestions when flight changes
        updateMawbSuggestionsForFlight(flightNumber);
    } else {
        // Clear MAWB suggestions if no flight selected
        clearMawbDatalist();
        const mawbInput = document.getElementById('mawb');
        if (mawbInput) {
            mawbInput.value = '';
            hideMawbDetails();
        }
    }
});