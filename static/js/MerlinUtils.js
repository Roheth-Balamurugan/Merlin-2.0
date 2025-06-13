// Merlin Utilities - Common functions used across the application

const MerlinUtils = {
    /**
     * Validate a form by checking required fields
     * @param {string} formId - The ID of the form to validate
     * @returns {boolean} - True if valid, false otherwise
     */
    validateForm: function(formId) {
        const form = document.getElementById(formId);
        if (!form) return false;
        
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;
        
        requiredFields.forEach(field => {
            const value = field.value.trim();
            
            if (!value) {
                field.classList.add('is-invalid');
                field.classList.remove('is-valid');
                isValid = false;
            } else {
                field.classList.remove('is-invalid');
                field.classList.add('is-valid');
            }
        });
        
        return isValid;
    },
    
    /**
     * Set loading state for a button
     * @param {string} buttonId - The ID of the button
     * @param {boolean} loading - Whether to show loading state
     */
    setLoadingState: function(buttonId, loading) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        const spinner = button.querySelector('.spinner-border');
        
        if (loading) {
            button.disabled = true;
            if (spinner) {
                spinner.classList.remove('d-none');
            }
        } else {
            button.disabled = false;
            if (spinner) {
                spinner.classList.add('d-none');
            }
        }
    },
    
    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - Debounced function
     */
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Format number with commas
     * @param {number} num - Number to format
     * @returns {string} - Formatted number
     */
    formatNumber: function(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },
    
    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * Get current timestamp in ISO format
     * @returns {string} - ISO timestamp
     */
    getCurrentTimestamp: function() {
        return new Date().toISOString();
    },
    
    /**
     * Format timestamp for display
     * @param {string} timestamp - ISO timestamp
     * @returns {string} - Formatted timestamp
     */
    formatTimestamp: function(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString();
    },
    
    /**
     * Show toast notification
     * @param {string} message - Message to show
     * @param {string} type - Type of toast (success, error, warning, info)
     */
    showToast: function(message, type = 'info') {
        // Create toast element if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '1055';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${this.getBootstrapClass(type)} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${this.escapeHtml(message)}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Initialize and show toast
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 5000
        });
        bsToast.show();
        
        // Remove from DOM after hiding
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    },
    
    /**
     * Get Bootstrap class for alert type
     * @param {string} type - Alert type
     * @returns {string} - Bootstrap class
     */
    getBootstrapClass: function(type) {
        const classes = {
            'success': 'success',
            'error': 'danger',
            'warning': 'warning',
            'info': 'info'
        };
        return classes[type] || 'info';
    },
    
    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise} - Promise that resolves when copied
     */
    copyToClipboard: function(text) {
        if (navigator.clipboard) {
            return navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return Promise.resolve();
        }
    },
    
    /**
     * Generate a random ID
     * @param {number} length - Length of ID
     * @returns {string} - Random ID
     */
    generateId: function(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    /**
     * Check if string is valid MAWB format
     * @param {string} mawb - MAWB to validate
     * @returns {boolean} - True if valid format
     */
    isValidMAWBFormat: function(mawb) {
        // Basic MAWB format validation (3 digits, dash, 8 digits)
        const mawbPattern = /^\d{3}-\d{8}$/;
        return mawbPattern.test(mawb);
    },
    
    /**
     * Format MAWB number
     * @param {string} mawb - Raw MAWB input
     * @returns {string} - Formatted MAWB
     */
    formatMAWB: function(mawb) {
        // Remove all non-digit characters
        const digits = mawb.replace(/\D/g, '');
        
        // Format as XXX-XXXXXXXX if we have enough digits
        if (digits.length >= 11) {
            return `${digits.substring(0, 3)}-${digits.substring(3, 11)}`;
        }
        
        return mawb; // Return as-is if not enough digits
    },
    
    /**
     * Sanitize input for API calls
     * @param {string} input - Raw input
     * @returns {string} - Sanitized input
     */
    sanitizeInput: function(input) {
        return input.trim().replace(/[<>\"']/g, '');
    }
};

// Global alert function for backward compatibility
function showAlert(message, type = 'info') {
    MerlinUtils.showToast(message, type);
}