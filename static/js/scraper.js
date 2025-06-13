// Scraper Admin JavaScript

let eventSource = null;
let isUploaded = false;
let totalMAWBs = 0;
let processedMAWBs = 0;

document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    
    // Initialize form handler
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleFileUpload);
    }
    
    // Initialize file input handler
    const fileInput = document.getElementById('file');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileChange);
    }
});

function handleFileChange(event) {
    const file = event.target.files[0];
    const startBtn = document.getElementById('startScrapeBtn');
    
    if (file) {
        // Validate file type
        const validTypes = ['.xlsx', '.xls', '.csv'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!validTypes.includes(fileExtension)) {
            showAlert('Invalid file type. Please select an Excel or CSV file.', 'error');
            event.target.value = ''; // Clear the input
            startBtn.classList.add('d-none');
            return;
        }
        
        // Validate file size (max 16MB)
        if (file.size > 16 * 1024 * 1024) {
            showAlert('File size too large. Please select a file smaller than 16MB.', 'error');
            event.target.value = '';
            startBtn.classList.add('d-none');
            return;
        }
        
        showAlert(`File "${file.name}" selected. Click upload to proceed.`, 'info');
    }
}

async function handleFileUpload(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('file');
    const uploadBtn = document.getElementById('uploadBtn');
    const startBtn = document.getElementById('startScrapeBtn');
    
    if (!fileInput.files[0]) {
        showAlert('Please select a file first.', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    // Set loading state
    MerlinUtils.setLoadingState('uploadBtn', true);
    
    try {
        const response = await fetch('/api/start_scrape', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(result.message, 'success');
            isUploaded = true;
            
            // Show start scraping button
            startBtn.classList.remove('d-none');
            uploadBtn.disabled = true;
            fileInput.disabled = true;
            
        } else {
            showAlert(result.message || 'Failed to upload file', 'error');
        }
        
    } catch (error) {
        console.error('File upload error:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        MerlinUtils.setLoadingState('uploadBtn', false);
    }
}

function startScraping() {
    if (!isUploaded) {
        showAlert('Please upload a file first.', 'error');
        return;
    }
    
    // Initialize progress tracking
    totalMAWBs = 0;
    processedMAWBs = 0;
    
    // Show progress card
    const progressCard = document.getElementById('progressCard');
    progressCard.classList.remove('d-none');
    
    // Clear results table
    clearResultsTable();
    
    // Disable start button
    const startBtn = document.getElementById('startScrapeBtn');
    startBtn.disabled = true;
    startBtn.innerHTML = '<i data-feather="loader" class="me-2"></i>Scraping...';
    feather.replace();
    
    // Start EventSource connection
    eventSource = new EventSource('/api/stream_scrape_updates');
    
    eventSource.onmessage = function(event) {
        handleScrapingUpdate(JSON.parse(event.data));
    };
    
    eventSource.onerror = function(error) {
        console.error('EventSource error:', error);
        showAlert('Connection lost. Please refresh and try again.', 'error');
        stopScraping();
    };
    
    // Update progress
    updateProgressText('Starting scraping process...');
}

function handleScrapingUpdate(data) {
    switch (data.type) {
        case 'start':
            totalMAWBs = data.total;
            updateProgress(0, totalMAWBs);
            updateProgressText(`Processing ${totalMAWBs} MAWB(s)...`);
            break;
            
        case 'scraping':
            updateProgressText(`Scraping ${data.mawb}...`);
            addOrUpdateResultRow(data.mawb, 'Scraping...', '', '', '', '');
            break;
            
        case 'scraped':
            const scrapedData = data.data;
            addOrUpdateResultRow(
                data.mawb,
                scrapedData.status || 'Unknown',
                scrapedData.location || 'Unknown',
                scrapedData.carrier || 'Unknown',
                scrapedData.last_update || 'Unknown',
                'Updating sheet...'
            );
            break;
            
        case 'updating':
            updateProgressText(`Updating Google Sheet for ${data.mawb}...`);
            break;
            
        case 'updated':
            updateResultRowSheetStatus(data.mawb, 'Updated');
            break;
            
        case 'error':
            updateResultRowSheetStatus(data.mawb, `Error: ${data.status}`);
            showAlert(`Error processing ${data.mawb}: ${data.status}`, 'warning');
            break;
            
        case 'progress':
            processedMAWBs = data.processed;
            updateProgress(processedMAWBs, data.total);
            updateProgressText(`Processed ${processedMAWBs} of ${data.total} MAWB(s)`);
            break;
            
        case 'complete':
            processedMAWBs = data.processed;
            updateProgress(processedMAWBs, data.total);
            updateProgressText(`Completed! Processed ${processedMAWBs} of ${data.total} MAWB(s)`);
            showAlert(`Scraping completed! Successfully processed ${processedMAWBs} MAWB(s).`, 'success');
            stopScraping();
            break;
            
        default:
            console.log('Unknown update type:', data);
    }
}

function updateProgress(current, total) {
    const progressBar = document.getElementById('progressBar');
    const progressCount = document.getElementById('progressCount');
    
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage);
    progressCount.textContent = `${current} / ${total}`;
}

function updateProgressText(text) {
    const progressText = document.getElementById('progressText');
    progressText.textContent = text;
}

function clearResultsTable() {
    const resultsBody = document.getElementById('resultsBody');
    resultsBody.innerHTML = '';
}

function addOrUpdateResultRow(mawb, status, location, carrier, lastUpdate, sheetStatus) {
    const resultsBody = document.getElementById('resultsBody');
    let row = document.getElementById(`row-${mawb}`);
    
    if (!row) {
        row = document.createElement('tr');
        row.id = `row-${mawb}`;
        resultsBody.appendChild(row);
    }
    
    // Determine status class
    let statusClass = 'status-info';
    if (status.includes('Error') || status === 'Unknown') {
        statusClass = 'status-error';
    } else if (status.includes('Delivered') || status.includes('Cleared')) {
        statusClass = 'status-success';
    } else if (status.includes('Hold') || status.includes('Delayed')) {
        statusClass = 'status-warning';
    }
    
    row.innerHTML = `
        <td><strong>${mawb}</strong></td>
        <td><span class="${statusClass}">${status}</span></td>
        <td>${location}</td>
        <td>${carrier}</td>
        <td>${lastUpdate}</td>
        <td><span id="sheet-${mawb}">${sheetStatus}</span></td>
    `;
}

function updateResultRowSheetStatus(mawb, status) {
    const sheetStatusSpan = document.getElementById(`sheet-${mawb}`);
    if (sheetStatusSpan) {
        sheetStatusSpan.textContent = status;
        
        if (status === 'Updated') {
            sheetStatusSpan.className = 'status-success';
        } else if (status.includes('Error')) {
            sheetStatusSpan.className = 'status-error';
        }
    }
}

function stopScraping() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    
    // Re-enable controls
    const startBtn = document.getElementById('startScrapeBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('file');
    
    startBtn.disabled = false;
    startBtn.innerHTML = '<i data-feather="play" class="me-2"></i>Start Scraping';
    startBtn.classList.add('d-none');
    
    uploadBtn.disabled = false;
    fileInput.disabled = false;
    fileInput.value = '';
    
    isUploaded = false;
    
    feather.replace();
}

// Handle page unload - clean up EventSource
window.addEventListener('beforeunload', function() {
    if (eventSource) {
        eventSource.close();
    }
});

// Export results functionality
function exportResults() {
    const table = document.getElementById('resultsTable');
    const rows = Array.from(table.querySelectorAll('tr'));
    
    if (rows.length <= 1) { // Only header row
        showAlert('No results to export.', 'info');
        return;
    }
    
    // Convert table to CSV
    const csvContent = rows.map(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return cells.map(cell => {
            const text = cell.textContent.trim();
            // Escape quotes and wrap in quotes if contains comma
            return text.includes(',') ? `"${text.replace(/"/g, '""')}"` : text;
        }).join(',');
    }).join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scraping_results_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showAlert('Results exported successfully!', 'success');
}

// Add export button if results exist
function checkForExportButton() {
    const resultsBody = document.getElementById('resultsBody');
    const exportBtn = document.getElementById('exportBtn');
    
    if (resultsBody.children.length > 0 && resultsBody.children[0].children.length > 1) {
        if (!exportBtn) {
            const cardBody = document.querySelector('#resultsCard .card-body');
            const exportButton = document.createElement('button');
            exportButton.id = 'exportBtn';
            exportButton.className = 'btn btn-outline-primary btn-sm mb-3';
            exportButton.innerHTML = '<i data-feather="download" class="me-1"></i>Export Results';
            exportButton.onclick = exportResults;
            
            cardBody.insertBefore(exportButton, cardBody.querySelector('.table-responsive'));
            feather.replace();
        }
    }
}

// Check for export button periodically
setInterval(checkForExportButton, 2000);

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Escape to stop scraping
    if (event.key === 'Escape' && eventSource) {
        if (confirm('Stop scraping process?')) {
            stopScraping();
        }
    }
    
    // Ctrl/Cmd + E to export results
    if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
        event.preventDefault();
        exportResults();
    }
});
