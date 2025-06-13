// Ramp Operations JavaScript with Google Sheets Integration

document.addEventListener('DOMContentLoaded', function() {
    const rampForm = document.getElementById('rampForm');
    
    // Initialize form handler
    if (rampForm) {
        rampForm.addEventListener('submit', handleRampSubmit);
    }
    
    // Initialize smart inputs with datalist population
    initializeSmartInputs();
    
    // Load initial MAWB suggestions
    loadMAWBSuggestions();
});

async function handleRampSubmit(event) {
    event.preventDefault();
    
    // Validate form
    if (!MerlinUtils.validateForm('rampForm')) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    // Get form data
    const formData = new FormData(event.target);
    const data = {
        mawb: formData.get('mawb').trim().toUpperCase(),
        received_pieces: parseInt(formData.get('received_pieces'))
    };
    
    // Validate received pieces
    if (isNaN(data.received_pieces) || data.received_pieces < 0) {
        showAlert('Please enter a valid number of pieces', 'error');
        return;
    }
    
    // Set loading state
    MerlinUtils.setLoadingState('submitBtn', true);
    
    try {
        const response = await fetch('/api/update_ramp_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(`MAWB ${data.mawb} updated with ${data.received_pieces} pieces received`, 'success');
            
            // Reset form after successful submission
            event.target.reset();
            
            // Remove validation classes
            const inputs = event.target.querySelectorAll('.form-control');
            inputs.forEach(input => {
                input.classList.remove('is-valid', 'is-invalid');
            });
            
            // Hide MAWB details
            hideMawbDetails();
            
            // Focus on first input
            const firstInput = event.target.querySelector('input');
            if (firstInput) {
                firstInput.focus();
            }
            
            // Refresh MAWB suggestions to reflect changes
            setTimeout(() => loadMAWBSuggestions(), 1000);
            
        } else {
            showAlert(result.message || 'Failed to update ramp data', 'error');
        }
        
    } catch (error) {
        console.error('Ramp update error:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        MerlinUtils.setLoadingState('submitBtn', false);
    }
}

function initializeSmartInputs() {
    const mawbInput = document.getElementById('mawb');
    const receivedPiecesInput = document.getElementById('received_pieces');
    
    // MAWB input handling
    if (mawbInput) {
        // Real-time search for MAWB
        let searchTimeout;
        mawbInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = this.value.trim();
                if (query.length >= 2) {
                    searchMAWBNumbers(query);
                } else {
                    // Clear datalist when query is too short
                    const datalist = document.getElementById('mawb-datalist');
                    if (datalist) {
                        datalist.innerHTML = '';
                    }
                }
            }, 300);
            
            // Clear MAWB details when input changes
            hideMawbDetails();
            
            // Remove validation classes on input
            if (this.classList.contains('is-invalid') && this.value.trim()) {
                this.classList.remove('is-invalid');
            }
        });
        
        // Clear datalist on focus to prevent dropdown on click
        mawbInput.addEventListener('focus', function() {
            const datalist = document.getElementById('mawb-datalist');
            if (datalist) {
                datalist.innerHTML = '';
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
    
    // Received pieces input validation
    if (receivedPiecesInput) {
        receivedPiecesInput.addEventListener('blur', function() {
            const value = parseInt(this.value);
            if (isNaN(value) || value < 0) {
                this.classList.add('is-invalid');
                this.classList.remove('is-valid');
            } else {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            }
        });
        
        receivedPiecesInput.addEventListener('input', function() {
            if (this.classList.contains('is-invalid') && !isNaN(parseInt(this.value)) && parseInt(this.value) >= 0) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            }
        });
    }
}

async function loadMAWBSuggestions() {
    try {
        const response = await fetch('/api/get_suggestions?column=MAWB&q=');
        const data = await response.json();
        
        const datalist = document.getElementById('mawb-datalist');
        if (datalist && data.success && data.suggestions) {
            updateDatalist(datalist, data.suggestions);
        }
    } catch (error) {
        console.error('Error loading MAWB suggestions:', error);
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
            
            // Auto-focus on received pieces input
            const receivedPiecesInput = document.getElementById('received_pieces');
            if (receivedPiecesInput) {
                receivedPiecesInput.focus();
            }
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

function showMawbDetails(mawbData) {
    const detailsDiv = document.getElementById('mawbDetails');
    
    if (detailsDiv) {
        document.getElementById('detailFlight').textContent = mawbData.flight_number || '-';
        document.getElementById('detailPieces').textContent = mawbData.pieces || '-';
        document.getElementById('detailWeight').textContent = mawbData.weight ? `${mawbData.weight} kg` : '-';
        document.getElementById('detailReceived').textContent = mawbData.current_received_pieces || '0';
        
        detailsDiv.classList.remove('d-none');
        
        // Highlight if pieces already received
        const currentReceived = parseInt(mawbData.current_received_pieces) || 0;
        const totalPieces = parseInt(mawbData.pieces) || 0;
        
        if (currentReceived > 0) {
            if (currentReceived >= totalPieces) {
                detailsDiv.className = 'alert alert-success mb-3';
                document.getElementById('detailReceived').innerHTML = `<strong>${currentReceived}</strong> (Complete)`;
            } else {
                detailsDiv.className = 'alert alert-warning mb-3';
                document.getElementById('detailReceived').innerHTML = `<strong>${currentReceived}</strong> (Partial)`;
            }
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
        await loadMAWBSuggestions();
        showAlert('Data refreshed successfully', 'success');
    } catch (error) {
        console.error('Error refreshing suggestions:', error);
        showAlert('Error refreshing data', 'error');
    }
}

// Handle form reset
document.getElementById('rampForm')?.addEventListener('reset', function() {
    // Remove all validation classes
    const inputs = this.querySelectorAll('.form-control');
    inputs.forEach(input => {
        input.classList.remove('is-valid', 'is-invalid');
    });
    
    // Hide MAWB details
    hideMawbDetails();
    
    // Focus on first input
    const firstInput = this.querySelector('input');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }
});

// Handle input formatting
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

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + Enter to submit form
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn && !submitBtn.disabled) {
            document.getElementById('rampForm')?.dispatchEvent(new Event('submit'));
        }
    }
    
    // Escape to clear form
    if (event.key === 'Escape') {
        const form = document.getElementById('rampForm');
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

// Auto-complete enhancement
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