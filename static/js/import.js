// Import Operations JavaScript

document.addEventListener('DOMContentLoaded', function() {
    const importForm = document.getElementById('importForm');
    
    // Initialize form handler
    if (importForm) {
        importForm.addEventListener('submit', handleImportSubmit);
    }
    
    // Initialize smart inputs
    initializeSmartInputs();
});

async function handleImportSubmit(event) {
    event.preventDefault();
    
    // Validate form
    if (!MerlinUtils.validateForm('importForm')) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    // Get form data
    const formData = new FormData(event.target);
    const data = {
        mawb: formData.get('mawb'),
        customs_status: formData.get('customs_status'),
        delivery_status: formData.get('delivery_status') || '',
        tracking_number: formData.get('tracking_number') || '',
        notes: formData.get('notes') || ''
    };
    
    // Set loading state
    MerlinUtils.setLoadingState('submitBtn', true);
    
    try {
        const response = await fetch('/api/update_import_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(result.message, 'success');
            
            // Reset form after successful submission
            event.target.reset();
            
            // Remove validation classes
            const inputs = event.target.querySelectorAll('.form-control, .form-select');
            inputs.forEach(input => {
                input.classList.remove('is-valid', 'is-invalid');
            });
            
            // Focus on first input
            const firstInput = event.target.querySelector('input');
            if (firstInput) {
                firstInput.focus();
            }
            
        } else {
            showAlert(result.message || 'Failed to update import data', 'error');
        }
        
    } catch (error) {
        console.error('Import update error:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        MerlinUtils.setLoadingState('submitBtn', false);
    }
}

function initializeSmartInputs() {
    // MAWB input with autocomplete
    const mawbInput = document.getElementById('mawb');
    if (mawbInput) {
        new MerlinUtils.SmartInput('mawb');
    }
    
    // Tracking number input with autocomplete
    const trackingInput = document.getElementById('tracking_number');
    if (trackingInput) {
        new MerlinUtils.SmartInput('tracking_number');
    }
    
    // Add real-time validation
    const requiredInputs = document.querySelectorAll('[required]');
    requiredInputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value.trim()) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            } else {
                this.classList.add('is-invalid');
                this.classList.remove('is-valid');
            }
        });
        
        input.addEventListener('input', function() {
            if (this.classList.contains('is-invalid') && this.value.trim()) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            }
        });
    });
}

// Handle form reset
document.getElementById('importForm')?.addEventListener('reset', function() {
    // Remove all validation classes
    const inputs = this.querySelectorAll('.form-control, .form-select');
    inputs.forEach(input => {
        input.classList.remove('is-valid', 'is-invalid');
    });
    
    // Focus on first input
    const firstInput = this.querySelector('input');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }
});

// Handle MAWB input formatting
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

// Handle tracking number formatting
document.getElementById('tracking_number')?.addEventListener('input', function(event) {
    // Convert to uppercase for consistency
    let value = event.target.value.toUpperCase();
    
    // Remove any non-alphanumeric characters
    value = value.replace(/[^A-Z0-9]/g, '');
    
    // Update the input value
    if (event.target.value !== value) {
        event.target.value = value;
    }
});

// Customs status-specific suggestions
document.getElementById('customs_status')?.addEventListener('change', function(event) {
    const status = event.target.value;
    const notesInput = document.getElementById('notes');
    const deliverySelect = document.getElementById('delivery_status');
    
    // Provide context-specific suggestions
    switch (status) {
        case 'Cleared':
            if (deliverySelect && !deliverySelect.value) {
                // Suggest setting delivery status when customs is cleared
                showAlert('Customs cleared! Consider updating delivery status.', 'info');
            }
            break;
        case 'Hold':
            if (notesInput && !notesInput.value) {
                notesInput.placeholder = 'Please specify reason for hold...';
                notesInput.focus();
            }
            break;
        case 'Inspection Required':
            if (notesInput && !notesInput.value) {
                notesInput.placeholder = 'Specify inspection requirements...';
            }
            break;
        case 'Documentation Required':
            if (notesInput && !notesInput.value) {
                notesInput.placeholder = 'List required documentation...';
            }
            break;
        default:
            if (notesInput) {
                notesInput.placeholder = 'Enter any additional notes';
            }
    }
});

// Delivery status-specific logic
document.getElementById('delivery_status')?.addEventListener('change', function(event) {
    const status = event.target.value;
    const trackingInput = document.getElementById('tracking_number');
    const notesInput = document.getElementById('notes');
    
    switch (status) {
        case 'Scheduled':
        case 'Out for Delivery':
            if (trackingInput && !trackingInput.value) {
                showAlert('Consider adding a tracking number for delivery updates.', 'info');
                trackingInput.focus();
            }
            break;
        case 'Failed Delivery':
            if (notesInput && !notesInput.value) {
                notesInput.placeholder = 'Specify reason for failed delivery...';
                notesInput.focus();
            }
            break;
        case 'Returned':
            if (notesInput && !notesInput.value) {
                notesInput.placeholder = 'Specify return reason and next steps...';
            }
            break;
    }
});

// Form validation dependencies
function validateCustomsAndDelivery() {
    const customsStatus = document.getElementById('customs_status').value;
    const deliveryStatus = document.getElementById('delivery_status').value;
    
    // Warn if trying to set delivery status without customs clearance
    if (deliveryStatus && ['Scheduled', 'Out for Delivery', 'Delivered'].includes(deliveryStatus)) {
        if (!['Cleared'].includes(customsStatus)) {
            showAlert('Warning: Delivery status set but customs may not be cleared.', 'warning');
        }
    }
}

// Add validation on form submit
document.getElementById('importForm')?.addEventListener('submit', function(event) {
    validateCustomsAndDelivery();
});

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + Enter to submit form
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn && !submitBtn.disabled) {
            document.getElementById('importForm')?.dispatchEvent(new Event('submit'));
        }
    }
    
    // Escape to clear form
    if (event.key === 'Escape') {
        const form = document.getElementById('importForm');
        if (form && confirm('Clear the form?')) {
            form.reset();
            form.dispatchEvent(new Event('reset'));
        }
    }
});

// Auto-save draft functionality (optional)
let draftTimer;
function saveDraft() {
    const formData = new FormData(document.getElementById('importForm'));
    const draft = {
        mawb: formData.get('mawb'),
        customs_status: formData.get('customs_status'),
        delivery_status: formData.get('delivery_status'),
        tracking_number: formData.get('tracking_number'),
        notes: formData.get('notes'),
        timestamp: Date.now()
    };
    
    localStorage.setItem('import_draft', JSON.stringify(draft));
}

// Load draft on page load
function loadDraft() {
    const draft = localStorage.getItem('import_draft');
    if (draft) {
        try {
            const data = JSON.parse(draft);
            // Only load if draft is less than 1 hour old
            if (Date.now() - data.timestamp < 3600000) {
                const form = document.getElementById('importForm');
                if (data.mawb) form.mawb.value = data.mawb;
                if (data.customs_status) form.customs_status.value = data.customs_status;
                if (data.delivery_status) form.delivery_status.value = data.delivery_status;
                if (data.tracking_number) form.tracking_number.value = data.tracking_number;
                if (data.notes) form.notes.value = data.notes;
                
                showAlert('Draft restored from previous session.', 'info');
            }
        } catch (error) {
            console.error('Error loading draft:', error);
        }
    }
}

// Set up auto-save (disabled by default, can be enabled)
const AUTO_SAVE_ENABLED = false;
if (AUTO_SAVE_ENABLED) {
    document.getElementById('importForm')?.addEventListener('input', function() {
        clearTimeout(draftTimer);
        draftTimer = setTimeout(saveDraft, 2000); // Save after 2 seconds of inactivity
    });
    
    // Clear draft on successful submission
    document.getElementById('importForm')?.addEventListener('submit', function() {
        localStorage.removeItem('import_draft');
    });
    
    // Load draft on page load
    loadDraft();
}
