// Main JavaScript file for shared functionality across Merlin app

// Global utility functions
function showAlert(message, type = 'info') {
    const alertContainer = document.querySelector('.alert-container') || createAlertContainer();
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.appendChild(alertDiv);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function createAlertContainer() {
    const container = document.createElement('div');
    container.className = 'alert-container';
    document.body.appendChild(container);
    return container;
}

// SmartInput functionality
class SmartInput {
    constructor(inputId) {
        this.input = document.getElementById(inputId);
        this.suggestionsContainer = document.getElementById(`${inputId}-suggestions`);
        this.currentFocus = -1;
        this.suggestions = [];
        
        if (this.input) {
            this.init();
        }
    }
    
    init() {
        // Add autocomplete functionality
        this.input.addEventListener('input', this.handleInput.bind(this));
        this.input.addEventListener('keydown', this.handleKeydown.bind(this));
        this.input.addEventListener('blur', this.handleBlur.bind(this));
        
        // Create suggestions container if it doesn't exist
        if (!this.suggestionsContainer) {
            this.suggestionsContainer = document.createElement('div');
            this.suggestionsContainer.className = 'autocomplete-suggestions';
            this.suggestionsContainer.id = `${this.input.id}-suggestions`;
            this.input.parentNode.appendChild(this.suggestionsContainer);
        }
    }
    
    async handleInput(event) {
        const value = event.target.value.trim();
        
        if (value.length < 2) {
            this.hideSuggestions();
            return;
        }
        
        try {
            const response = await fetch(`/api/get_suggestions?column=${this.input.name}&q=${encodeURIComponent(value)}`);
            const data = await response.json();
            
            this.suggestions = data.suggestions || [];
            this.showSuggestions();
            
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            this.hideSuggestions();
        }
    }
    
    handleKeydown(event) {
        if (!this.suggestionsContainer || this.suggestionsContainer.style.display === 'none') {
            return;
        }
        
        const suggestions = this.suggestionsContainer.querySelectorAll('.autocomplete-suggestion');
        
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.currentFocus++;
            if (this.currentFocus >= suggestions.length) this.currentFocus = 0;
            this.setActive(suggestions);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.currentFocus--;
            if (this.currentFocus < 0) this.currentFocus = suggestions.length - 1;
            this.setActive(suggestions);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (this.currentFocus > -1 && suggestions[this.currentFocus]) {
                this.selectSuggestion(suggestions[this.currentFocus].textContent);
            }
        } else if (event.key === 'Escape') {
            this.hideSuggestions();
        }
    }
    
    handleBlur() {
        // Delay hiding to allow for suggestion clicks
        setTimeout(() => {
            this.hideSuggestions();
        }, 150);
    }
    
    showSuggestions() {
        if (this.suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        this.suggestionsContainer.innerHTML = '';
        
        this.suggestions.forEach((suggestion, index) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-suggestion';
            div.textContent = suggestion;
            div.addEventListener('click', () => this.selectSuggestion(suggestion));
            this.suggestionsContainer.appendChild(div);
        });
        
        this.suggestionsContainer.style.display = 'block';
        this.currentFocus = -1;
    }
    
    hideSuggestions() {
        if (this.suggestionsContainer) {
            this.suggestionsContainer.style.display = 'none';
        }
        this.currentFocus = -1;
    }
    
    setActive(suggestions) {
        suggestions.forEach((suggestion, index) => {
            suggestion.classList.toggle('active', index === this.currentFocus);
        });
    }
    
    selectSuggestion(value) {
        this.input.value = value;
        this.hideSuggestions();
        this.input.focus();
    }
}

// Barcode Scanner functionality
class BarcodeScanner {
    constructor() {
        this.html5QrCode = null;
        this.isScanning = false;
        this.targetInput = null;
    }
    
    async startScan(inputId) {
        this.targetInput = document.getElementById(inputId);
        
        if (!this.targetInput) {
            showAlert('Target input not found', 'error');
            return;
        }
        
        // Show scanner modal
        const modal = new bootstrap.Modal(document.getElementById('scannerModal'));
        modal.show();
        
        try {
            this.html5QrCode = new Html5Qrcode("reader");
            
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };
            
            await this.html5QrCode.start(
                { facingMode: "environment" },
                config,
                this.onScanSuccess.bind(this),
                this.onScanFailure.bind(this)
            );
            
            this.isScanning = true;
            
        } catch (error) {
            console.error('Scanner start error:', error);
            showAlert('Failed to start camera. Please check permissions.', 'error');
            modal.hide();
        }
    }
    
    onScanSuccess(decodedText, decodedResult) {
        console.log('Scan successful:', decodedText);
        
        if (this.targetInput) {
            this.targetInput.value = decodedText;
            // Trigger input event for autocomplete
            this.targetInput.dispatchEvent(new Event('input'));
        }
        
        this.stopScan();
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('scannerModal'));
        if (modal) {
            modal.hide();
        }
        
        showAlert('Barcode scanned successfully!', 'success');
    }
    
    onScanFailure(error) {
        // Scan failures are normal, don't show errors for each one
        console.debug('Scan failure:', error);
    }
    
    async stopScan() {
        if (this.html5QrCode && this.isScanning) {
            try {
                await this.html5QrCode.stop();
                this.html5QrCode.clear();
                this.html5QrCode = null;
                this.isScanning = false;
            } catch (error) {
                console.error('Error stopping scanner:', error);
            }
        }
    }
}

// Global scanner instance
const scanner = new BarcodeScanner();

// Global functions for scanner
function startScan(inputId) {
    scanner.startScan(inputId);
}

function stopScan() {
    scanner.stopScan();
}

// Form validation utilities
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('is-invalid');
            isValid = false;
        } else {
            field.classList.remove('is-invalid');
            field.classList.add('is-valid');
        }
    });
    
    return isValid;
}

// Loading state management
function setLoadingState(buttonId, loading = true) {
    const button = document.getElementById(buttonId);
    const spinner = document.getElementById(`${buttonId.replace('Btn', 'Spinner')}`);
    
    if (button) {
        button.disabled = loading;
        if (loading) {
            button.classList.add('loading');
        } else {
            button.classList.remove('loading');
        }
    }
    
    if (spinner) {
        spinner.classList.toggle('d-none', !loading);
    }
}

// Initialize components on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize smart inputs for common fields
    const smartInputFields = ['mawb', 'location', 'tracking_number'];
    
    smartInputFields.forEach(fieldId => {
        if (document.getElementById(fieldId)) {
            new SmartInput(fieldId);
        }
    });
    
    // Initialize Feather icons if not already done
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    // Auto-focus first input on forms
    const firstInput = document.querySelector('form input:not([type="hidden"])');
    if (firstInput) {
        firstInput.focus();
    }
});

// Handle modal cleanup when hidden
document.addEventListener('hidden.bs.modal', function(event) {
    if (event.target.id === 'scannerModal') {
        scanner.stopScan();
    }
});

// Export for use in other scripts
window.MerlinUtils = {
    showAlert,
    validateForm,
    setLoadingState,
    SmartInput,
    BarcodeScanner
};
