/**
 * Token Inspector Settings Script
 * 
 * This script manages the settings interface for the Token Inspector extension.
 * It allows users to view, edit, and save flagged variables that are used 
 * during scanning to identify hardcoded values.
 * 
 * Key Features:
 * - Load current flagged variables from JSON file
 * - Edit variables in a textarea with JSON syntax
 * - Save changes back to the JSON file
 * - Cancel changes and revert to original values
 * - Navigate back to main popup
 * - Input validation and error handling
 * 
 * @version 1.0
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Settings page loaded');
    
    // UI Elements
    const textarea = document.getElementById('flagged-variables-textarea');
    const saveBtn = document.getElementById('save-changes-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const headerScan = document.querySelector('.header-scan');
    const downloadBtn = document.getElementById('download-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const jsonEditor = document.getElementById('json-editor');
    const lineNumbers = document.getElementById('line-numbers');
    const syntaxOverlay = document.getElementById('syntax-overlay');
    const validationStatus = document.getElementById('validation-status');
    
    // State Management
    let originalVariables = [];
    let hasUnsavedChanges = false;
    let validationTimeout = null;
    
    /**
     * Update line numbers based on textarea content
     */
    function updateLineNumbers() {
        const lines = textarea.value.split('\n');
        const lineCount = lines.length;
        
        let numbersHtml = '';
        for (let i = 1; i <= lineCount; i++) {
            numbersHtml += i + '\n';
        }
        
        lineNumbers.textContent = numbersHtml;
    }
    
    /**
     * Apply JSON syntax highlighting
     */
    function applySyntaxHighlighting() {
        const content = textarea.value;
        
        // Simple JSON syntax highlighting
        let highlighted = content
            // Escape HTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Highlight strings (including keys)
            .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content, offset) => {
                // Check if this is a key (followed by colon) or value
                const nextChar = offset + match.length;
                const remaining = content.substring(nextChar).trim();
                if (remaining.startsWith(':')) {
                    return `<span class="json-key">${match}</span>`;
                } else {
                    return `<span class="json-string">${match}</span>`;
                }
            })
            // Highlight numbers
            .replace(/\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, '<span class="json-number">$&</span>')
            // Highlight booleans
            .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
            // Highlight null
            .replace(/\bnull\b/g, '<span class="json-null">null</span>')
            // Highlight brackets and braces
            .replace(/[\[\]{}]/g, '<span class="json-bracket">$&</span>')
            // Highlight commas
            .replace(/,/g, '<span class="json-comma">,</span>');
        
        syntaxOverlay.innerHTML = highlighted;
    }
    
    /**
     * Validate JSON content and show status
     */
    function validateJson() {
        clearTimeout(validationTimeout);
        
        validationTimeout = setTimeout(() => {
            const content = textarea.value.trim();
            
            if (!content) {
                validationStatus.className = 'validation-status';
                validationStatus.textContent = '';
                jsonEditor.classList.remove('error');
                return;
            }
            
            try {
                const parsed = JSON.parse(content);
                
                // Additional validation for flagged variables
                if (!Array.isArray(parsed)) {
                    throw new Error('Must be an array');
                }
                
                for (let i = 0; i < parsed.length; i++) {
                    if (typeof parsed[i] !== 'string') {
                        throw new Error(`Item ${i + 1} must be a string`);
                    }
                }
                
                // Valid JSON
                validationStatus.className = 'validation-status valid';
                validationStatus.textContent = `✓ Valid (${parsed.length} items)`;
                jsonEditor.classList.remove('error');
                
            } catch (error) {
                // Invalid JSON
                validationStatus.className = 'validation-status invalid';
                validationStatus.textContent = `✗ ${error.message}`;
                jsonEditor.classList.add('error');
            }
        }, 300);
    }
    
    /**
     * Update the JSON editor display
     */
    function updateJsonEditor() {
        updateLineNumbers();
        applySyntaxHighlighting();
        validateJson();
    }
    
    /**
     * Format JSON content with proper indentation
     */
    function formatJson() {
        try {
            const content = textarea.value.trim();
            if (!content) return;
            
            const parsed = JSON.parse(content);
            const formatted = JSON.stringify(parsed, null, 4);
            
            // Store cursor position
            const cursorPos = textarea.selectionStart;
            
            textarea.value = formatted;
            
            // Restore cursor position (approximately)
            const lines = formatted.substring(0, cursorPos).split('\n');
            const newPos = Math.min(cursorPos, formatted.length);
            textarea.setSelectionRange(newPos, newPos);
            
            updateJsonEditor();
            
        } catch (error) {
            // If parsing fails, leave as is
            console.log('Invalid JSON, cannot format');
        }
    }
    
    /**
     * Handle textarea scroll to sync syntax overlay
     */
    function syncScroll() {
        syntaxOverlay.scrollTop = textarea.scrollTop;
        syntaxOverlay.scrollLeft = textarea.scrollLeft;
    }
    
    /**
     * Load flagged variables from chrome storage first, then fallback to JSON file
     */
    function loadFlaggedVariables() {
        jsonEditor.classList.add('loading');
        textarea.value = 'Loading variables...';
        updateJsonEditor();
        
        // First try to load from chrome storage
        chrome.storage.local.get(['flagged-variables'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Chrome storage error:', chrome.runtime.lastError);
                loadFromJsonFile();
                return;
            }
            
            if (result['flagged-variables'] && Array.isArray(result['flagged-variables'])) {
                // Use saved variables from chrome storage
                originalVariables = [...result['flagged-variables']];
                const formattedJson = JSON.stringify(originalVariables, null, 4);
                textarea.value = formattedJson;
                jsonEditor.classList.remove('loading', 'error');
                updateJsonEditor();
                console.log('Loaded flagged variables from storage:', originalVariables.length, 'items');
            } else {
                // Fallback to loading from JSON file
                loadFromJsonFile();
            }
        });
    }
    
    /**
     * Fallback function to load from JSON file
     */
    async function loadFromJsonFile() {
        try {
            const response = await fetch(chrome.runtime.getURL('flagged-variables.json'));
            if (!response.ok) {
                throw new Error(`Failed to load variables: ${response.status}`);
            }
            
            const variables = await response.json();
            originalVariables = [...variables];
            
            // Format JSON for display with proper indentation
            const formattedJson = JSON.stringify(variables, null, 4);
            textarea.value = formattedJson;
            jsonEditor.classList.remove('loading', 'error');
            updateJsonEditor();
            
            console.log('Loaded flagged variables from JSON file:', variables.length, 'items');
            
        } catch (error) {
            console.error('Error loading flagged variables:', error);
            jsonEditor.classList.remove('loading');
            jsonEditor.classList.add('error');
            textarea.value = 'Error loading variables. Please try again.';
            updateJsonEditor();
            showError('Failed to load flagged variables. Please refresh the page.');
        }
    }
    
    /**
     * Save flagged variables to chrome storage
     */
    function saveFlaggedVariables() {
        try {
            // Validate JSON format
            const textValue = textarea.value.trim();
            if (!textValue) {
                throw new Error('Variables list cannot be empty');
            }
            
            let parsedVariables;
            try {
                parsedVariables = JSON.parse(textValue);
            } catch (parseError) {
                throw new Error('Invalid JSON format. Please check your syntax.');
            }
            
            // Validate that it's an array
            if (!Array.isArray(parsedVariables)) {
                throw new Error('Variables must be an array of strings');
            }
            
            // Validate that all items are strings
            for (let i = 0; i < parsedVariables.length; i++) {
                if (typeof parsedVariables[i] !== 'string') {
                    throw new Error(`Item at index ${i} must be a string`);
                }
            }
            
            // Show saving state
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            
            // Save to chrome storage using callback
            chrome.storage.local.set({
                'flagged-variables': parsedVariables
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving to chrome storage:', chrome.runtime.lastError);
                    showError('Failed to save changes: ' + chrome.runtime.lastError.message);
                    
                    // Reset save button
                    saveBtn.textContent = 'Save Changes';
                    saveBtn.disabled = false;
                    return;
                }
                
                // Update original variables
                originalVariables = [...parsedVariables];
                hasUnsavedChanges = false;
                updateButtonStates();
                
                // Show success feedback
                saveBtn.textContent = 'Saved!';
                setTimeout(() => {
                    saveBtn.textContent = 'Save Changes';
                    saveBtn.disabled = false;
                }, 1500);
                
                console.log('Successfully saved flagged variables:', parsedVariables.length, 'items');
            });
            
        } catch (error) {
            console.error('Error saving flagged variables:', error);
            showError(error.message);
            
            // Reset save button
            saveBtn.textContent = 'Save Changes';
            saveBtn.disabled = false;
        }
    }
    
    /**
     * Cancel changes and revert to original values
     */
    function cancelChanges() {
        if (hasUnsavedChanges) {
            const confirmed = confirm('You have unsaved changes. Are you sure you want to cancel?');
            if (!confirmed) return;
        }
        
        // Revert to original values
        const formattedJson = JSON.stringify(originalVariables, null, 4);
        textarea.value = formattedJson;
        hasUnsavedChanges = false;
        updateButtonStates();
        updateJsonEditor();
        
        console.log('Changes cancelled, reverted to original values');
    }
    
    /**
     * Navigate back to main popup
     */
    function navigateToPopup() {
        if (hasUnsavedChanges) {
            const confirmed = confirm('You have unsaved changes. Are you sure you want to leave?');
            if (!confirmed) return;
        }
        
        window.location.href = 'popup.html';
    }
    
    /**
     * Check if textarea content has changed
     */
    function checkForChanges() {
        const currentValue = textarea.value.trim();
        const originalFormatted = JSON.stringify(originalVariables, null, 4);
        
        hasUnsavedChanges = currentValue !== originalFormatted;
        updateButtonStates();
    }
    
    /**
     * Update button states based on changes
     */
    function updateButtonStates() {
        saveBtn.disabled = !hasUnsavedChanges || textarea.value.trim() === '';
        cancelBtn.disabled = !hasUnsavedChanges;
    }
    
    /**
     * Show error message to user
     */
    function showError(message) {
        // Create or update error message element
        let errorElement = document.querySelector('.error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            textarea.parentNode.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        errorElement.classList.add('show');
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorElement.classList.remove('show');
        }, 5000);
    }
    
    /**
     * Download current flagged variables as JSON file
     */
    function downloadFlaggedVariables() {
        try {
            const textValue = textarea.value.trim();
            if (!textValue) {
                showError('No data to download');
                return;
            }
            
            // Validate JSON before downloading
            let parsedVariables;
            try {
                parsedVariables = JSON.parse(textValue);
            } catch (parseError) {
                showError('Invalid JSON format. Please fix errors before downloading.');
                return;
            }
            
            // Create blob and download
            const blob = new Blob([JSON.stringify(parsedVariables, null, 4)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'flagged-variables.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('Downloaded flagged variables JSON file');
            
        } catch (error) {
            console.error('Error downloading file:', error);
            showError('Failed to download file: ' + error.message);
        }
    }
    
    /**
     * Handle file upload for flagged variables
     */
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            showError('Please select a valid JSON file');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                const parsedVariables = JSON.parse(content);
                
                // Validate that it's an array of strings
                if (!Array.isArray(parsedVariables)) {
                    throw new Error('JSON must contain an array of strings');
                }
                
                for (let i = 0; i < parsedVariables.length; i++) {
                    if (typeof parsedVariables[i] !== 'string') {
                        throw new Error(`Item at index ${i} must be a string`);
                    }
                }
                
                // Update textarea with uploaded content
                const formattedJson = JSON.stringify(parsedVariables, null, 4);
                textarea.value = formattedJson;
                updateJsonEditor();
                
                // Check for changes
                checkForChanges();
                
                console.log('Successfully loaded', parsedVariables.length, 'variables from file');
                
            } catch (error) {
                console.error('Error parsing uploaded file:', error);
                showError('Invalid JSON file: ' + error.message);
            }
        };
        
        reader.onerror = function() {
            showError('Failed to read file');
        };
        
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    }
    
    // Event Listeners
    textarea.addEventListener('input', function() {
        updateJsonEditor();
        checkForChanges();
        // Clear error state when user starts typing
        jsonEditor.classList.remove('error');
        const errorElement = document.querySelector('.error-message');
        if (errorElement) {
            errorElement.classList.remove('show');
        }
    });
    
    textarea.addEventListener('scroll', syncScroll);
    
    textarea.addEventListener('blur', function() {
        // Auto-format JSON when user leaves textarea
        if (textarea.value.trim()) {
            formatJson();
            checkForChanges();
        }
    });
    
    // Handle tab indentation
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const value = textarea.value;
            
            if (e.shiftKey) {
                // Shift+Tab: Remove indentation
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = value.indexOf('\n', end);
                const actualEnd = lineEnd === -1 ? value.length : lineEnd;
                const selectedLines = value.substring(lineStart, actualEnd);
                
                if (selectedLines.startsWith('    ')) {
                    const newValue = value.substring(0, lineStart) + 
                                   selectedLines.substring(4) + 
                                   value.substring(actualEnd);
                    textarea.value = newValue;
                    textarea.setSelectionRange(start - 4, end - 4);
                    updateJsonEditor();
                }
            } else {
                // Tab: Add indentation
                textarea.value = value.substring(0, start) + '    ' + value.substring(end);
                textarea.setSelectionRange(start + 4, start + 4);
                updateJsonEditor();
            }
        }
        
        // Ctrl/Cmd + F for formatting
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            formatJson();
            checkForChanges();
        }
    });
    
    saveBtn.addEventListener('click', saveFlaggedVariables);
    cancelBtn.addEventListener('click', cancelChanges);
    headerScan.addEventListener('click', navigateToPopup);
    downloadBtn.addEventListener('click', downloadFlaggedVariables);
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (!saveBtn.disabled) {
                saveFlaggedVariables();
            }
        }
        
        // Escape to cancel
        if (e.key === 'Escape') {
            cancelChanges();
        }
    });
    
    // Warn user about unsaved changes when closing
    window.addEventListener('beforeunload', function(e) {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return e.returnValue;
        }
    });
    
    // Initialize the page
    loadFlaggedVariables();
    updateButtonStates();
    
    console.log('Settings page initialized');
});