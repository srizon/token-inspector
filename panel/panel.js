/**
 * Token Inspector DevTools Panel Script
 * 
 * This script manages the DevTools panel interface for the Token Inspector extension.
 * It provides a developer-focused interface for scanning web pages and viewing results
 * with enhanced debugging capabilities.
 * 
 * Key Features:
 * - Automatic scanning when panel opens
 * - Category-based result filtering
 * - Element highlighting on click
 * - Real-time scan status updates
 * - Responsive UI with loading states
 * 
 * @version 2.0
 */
document.addEventListener('DOMContentLoaded', function() {
    // UI Elements
    const scanButton = document.getElementById('scan-button');
    const clearHighlightButton = document.getElementById('clear-highlight-button');
    const scannerState = document.getElementById('scanner-state');
    const resultsContainer = document.getElementById('results-container');
    const noResultsMessage = document.getElementById('no-results-message');
    const categoryTabs = document.getElementById('category-tabs');
    
    // State Management
    let allResults = {};
    let currentCategory = 'all';
    let selectedElementId = null; // Track the currently selected element
    let contentScriptReady = false;

    /**
     * Initialize the shared scanner for panel
     * Configures callbacks for scan lifecycle events
     */
    const scanner = new TokenInspectorScanner({
        isDevTools: true,
        onScanStart: () => {
            scannerState.style.display = 'flex';
            resultsContainer.style.display = 'none';
            noResultsMessage.style.display = 'none';
            categoryTabs.style.display = 'none';
        },
        onScanComplete: () => {
            scannerState.style.display = 'none';
        },
        onResultsReady: (results) => {
            displayResults(results);
        },
        onError: (error) => {
            console.error('Token Inspector Panel: Error:', error);
            scannerState.style.display = 'none';
        }
    });

    /**
     * Listen for messages from content script
     * Handles scan completion and content script ready signals
     */
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'scanComplete') {
            scanner.onScanComplete();
            displayResults(request.results);
        } else if (request.type === 'contentScriptReady') {
            console.log('Token Inspector Panel: Content script is ready');
            contentScriptReady = true;
        }
    });

    /**
     * Initialize content script for DevTools panel
     * Ensures the content script is injected and ready before scanning
     */
    function initializeContentScript() {
        return new Promise((resolve, reject) => {
            // First, check if we can access the current tab
            chrome.tabs.get(chrome.devtools.inspectedWindow.tabId, (tab) => {
                if (chrome.runtime.lastError) {
                    console.warn('Token Inspector Panel: Cannot access tab:', chrome.runtime.lastError.message);
                    reject(new Error('Cannot access tab: ' + chrome.runtime.lastError.message));
                    return;
                }

                // Check if the URL is injectable
                const url = tab.url || '';
                if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('devtools://')) {
                    console.warn('Token Inspector Panel: Cannot inject into restricted URL:', url);
                    reject(new Error('Cannot inject into restricted URL: ' + url));
                    return;
                }

                // Inject content script
                chrome.scripting.executeScript({
                    target: { tabId: chrome.devtools.inspectedWindow.tabId },
                    files: ['content/content.js']
                }).then(() => {
                    console.log('Token Inspector Panel: Content script injected successfully');
                    
                    // Test if content script is responsive
                    const testContentScript = () => {
                        chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, { action: 'ping' })
                            .then(response => {
                                console.log('Token Inspector Panel: Ping response:', response);
                                if (response && response.success) {
                                    console.log('Token Inspector Panel: Content script is responsive');
                                    resolve();
                                } else {
                                    console.log('Token Inspector Panel: Content script not responsive, retrying...');
                                    setTimeout(testContentScript, 200);
                                }
                            })
                            .catch(err => {
                                console.log('Token Inspector Panel: Ping failed, retrying...', err);
                                setTimeout(testContentScript, 200);
                            });
                    };
                    
                    // Start testing after a short delay to ensure content script is fully initialized
                    setTimeout(testContentScript, 500);
                    
                    // Timeout after 5 seconds
                    setTimeout(() => {
                        console.log('Token Inspector Panel: Content script timeout, proceeding anyway');
                        resolve();
                    }, 5000);
                    
                }).catch(err => {
                    console.error('Token Inspector Panel: Content script injection failed:', err);
                    reject(err);
                });
            });
        });
    }

    /**
     * Start scanning with proper DevTools initialization
     */
    function startScan() {
        // Reset UI state
        scannerState.style.display = 'flex';
        resultsContainer.style.display = 'none';
        noResultsMessage.style.display = 'none';
        categoryTabs.style.display = 'none';
        
        // Clear previous results and selection
        allResults = {};
        currentCategory = 'all';
        selectedElementId = null;
        
        // Initialize content script first, then start scan
        initializeContentScript()
            .then(() => {
                console.log('Token Inspector Panel: Starting scan...');
                
                // Send runScan message directly to content script
                chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, { action: 'runScan' })
                    .then(response => {
                        console.log('Token Inspector Panel: Scan response:', response);
                        if (response && response.success && response.results) {
                            // Results received immediately
                            displayResults(response.results);
                        } else if (response && response.success) {
                            // Wait for async results via message listener
                            console.log('Token Inspector Panel: Waiting for async scan results...');
                        } else {
                            console.error('Token Inspector Panel: Scan failed:', response);
                            // Fall back to shared scanner
                            scanner.startScan();
                        }
                    })
                    .catch(err => {
                        console.error('Token Inspector Panel: Error sending scan message:', err);
                        // Fall back to shared scanner
                        scanner.startScan();
                    });
            })
            .catch(err => {
                console.error('Token Inspector Panel: Failed to initialize content script:', err);
                // Fall back to shared scanner
                scanner.startScan();
            });
    }

    /**
     * Display results with tab functionality (same as popup)
     * Converts scan results to UI elements and sets up category filtering
     * 
     * @param {Object} results - Scan results organized by category
     */
    function displayResults(results) {
        resultsContainer.innerHTML = '';

        // Handle both array format (old) and object format (new)
        if (Array.isArray(results)) {
            // Convert array format to object format for consistency
            const converted = {};
            results.forEach(item => {
                let category = 'Other Properties';
                if (item.category === 'Colors' || item.property.includes('Color')) {
                    category = 'Colors';
                } else if (item.category === 'Typography' || item.property.includes('Font') || item.property.includes('Line')) {
                    category = 'Typography';
                } else if (item.category === 'Spacing' || item.property.includes('Margin') || item.property.includes('Padding')) {
                    category = 'Spacing';
                } else if (item.category === 'Border' || item.property.includes('Border')) {
                    category = 'Border';
                }
                
                if (!converted[category]) {
                    converted[category] = [];
                }
                converted[category].push(item);
            });
            results = converted;
        }

        // Store results for category tabs
        allResults = results;

        // Check if we have any results
        const totalIssues = Object.values(results).reduce((sum, items) => sum + items.length, 0);
        if (totalIssues === 0) {
            noResultsMessage.style.display = 'flex';
            return;
        }

        // Show category tabs and display results
        categoryTabs.style.display = 'block';
        resultsContainer.style.display = 'block';
        
        // Update tab counts
        updateTabCounts();
        
        // Setup tab functionality
        setupCategoryTabs();
        
        // Display current category
        displayCurrentCategory();
    }

    /**
     * Update the count badges on category tabs
     * Shows the number of violations in each category
     */
    function updateTabCounts() {
        const totalIssues = Object.values(allResults).reduce((sum, items) => sum + items.length, 0);
        
        // Update all count
        const allCount = document.getElementById('all-count');
        if (allCount) allCount.textContent = totalIssues;
        
        // Update individual category counts
        const categories = ['Colors', 'Spacing', 'Border', 'Typography'];
        categories.forEach(category => {
            const countElement = document.getElementById(category.toLowerCase() + '-count');
            if (countElement) {
                const count = allResults[category] ? allResults[category].length : 0;
                countElement.textContent = count;
            }
        });
    }

    /**
     * Setup category tab click handlers
     * Enables filtering results by category
     */
    function setupCategoryTabs() {
        const tabButtons = categoryTabs.querySelectorAll('.tab-button');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update active tab
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update current category and display
                currentCategory = button.dataset.category;
                displayCurrentCategory();
            });
        });
    }

    /**
     * Display results for the current category
     * Shows either all categories or a specific category based on selection
     */
    function displayCurrentCategory() {
        resultsContainer.innerHTML = '';

        if (currentCategory === 'all') {
            // Display all categories in the specified order
            const categoryOrder = ['Colors', 'Spacing', 'Border', 'Typography'];
            for (const category of categoryOrder) {
                const items = allResults[category];
                if (items && items.length > 0) {
                    const section = createCategorySection(category, items);
                    resultsContainer.appendChild(section);
                }
            }
        } else {
            // Display specific category
            const items = allResults[currentCategory] || [];
            if (items.length > 0) {
                const section = createCategorySection(currentCategory, items);
                resultsContainer.appendChild(section);
            }
        }
    }

    /**
     * Update the visual selection state of items
     * Highlights the currently selected item
     */
    function updateItemSelection() {
        // Remove selected class from all items
        const allItems = document.querySelectorAll('.issue-card');
        allItems.forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selected class to the currently selected item
        if (selectedElementId) {
            const selectedItem = document.querySelector(`[data-element-id="${selectedElementId}"]`);
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }
        }
    }

    /**
     * Create a category section with header and items
     * 
     * @param {string} category - Category name
     * @param {Array} items - Array of issue items
     * @returns {HTMLElement} Category section element
     */
    function createCategorySection(category, items) {
        const section = document.createElement('div');
        section.className = 'category-section';

        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `<span class="category-title">${category}</span><span class="category-count">${items.length}</span>`;

        const list = document.createElement('div');
        list.className = 'results-list';

        items.forEach(itemData => {
            const card = createIssueCard(itemData, category);
            list.appendChild(card);
        });

        section.appendChild(header);
        section.appendChild(list);
        return section;
    }

    /**
     * Create an issue card with click handling and highlighting
     * 
     * @param {Object} itemData - Issue data
     * @param {string} category - Category name
     * @returns {HTMLElement} Issue card element
     */
    function createIssueCard(itemData, category) {
        const card = document.createElement('div');
        card.className = 'issue-card';
        card.dataset.elementId = itemData.elementId;
        
        // Check if this item should be selected
        if (selectedElementId === itemData.elementId) {
            card.classList.add('selected');
        }

        // Format the value to show the original format (hex vs rgba)
        const formattedValue = formatCssValue(itemData.value);

        card.innerHTML = `
            <span class="issue-selector">${itemData.selector}</span>
            <span class="issue-brace">{</span>
            <br>
            <span class="issue-property">  ${itemData.property}</span>
            <span class="issue-colon">:</span>
            <span class="issue-value-editable" data-original-value="${itemData.value}">${formattedValue}</span>
            <span class="issue-semicolon">;</span>
            <br>
            <span class="issue-brace">}</span>
            <div class="edit-controls">
                <button class="apply-button">Apply</button>
                <button class="cancel-button">Cancel</button>
                <span class="edit-status"></span>
            </div>
        `;

        // Add click handler for element highlighting
        card.addEventListener('click', (event) => {
            // Prevent event bubbling
            event.stopPropagation();
            
            // Update selected state
            selectedElementId = itemData.elementId;
            
            // Update visual selection
            updateItemSelection();
            
            // Highlight element on the page
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.devtools && chrome.devtools.inspectedWindow) {
                    // Use DevTools API for highlighting
                    const escapeString = (str) => {
                        if (!str) return '';
                        return str.replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                    };
                    
                    const highlightScript = `
                        (function(elementId, selector, path) {
                            // Try multiple ways to find the element
                            let element = document.querySelector('[data-ds-lint-id="' + elementId + '"]');
                            
                            // If not found by data attribute, try by selector
                            if (!element && selector) {
                                try {
                                    element = document.querySelector(selector);
                                } catch (e) {
                                    // Invalid selector, continue
                                }
                            }
                            
                            // If still not found, try to find by path
                            if (!element && path) {
                                const pathParts = path.split(' › ');
                                if (pathParts.length > 0) {
                                    try {
                                        element = document.querySelector(pathParts[pathParts.length - 1]);
                                    } catch (e) {
                                        // Invalid path selector, continue
                                    }
                                }
                            }
                            
                            if (element) {
                                // Clear all previous highlights
                                const highlightedElements = document.querySelectorAll('.ds-lint-highlight');
                                highlightedElements.forEach(el => {
                                    // Remove the highlight overlay
                                    if (el.highlightOverlay && el.highlightOverlay.parentNode) {
                                        el.highlightOverlay.parentNode.removeChild(el.highlightOverlay);
                                    }
                                    
                                    // Restore original styles
                                    if (el.originalPosition !== undefined) {
                                        el.style.position = el.originalPosition;
                                    } else {
                                        el.style.removeProperty('position');
                                    }
                                    el.style.removeProperty('z-index');
                                    
                                    el.classList.remove('ds-lint-highlight');
                                    el.highlightOverlay = null;
                                    el.originalPosition = null;
                                });
                                
                                // Remove any existing click event listeners by removing all listeners
                                // We'll use a more targeted approach by storing the listener reference
                                if (window.dsLint && window.dsLint.currentClickListener) {
                                    document.removeEventListener('click', window.dsLint.currentClickListener);
                                    window.dsLint.currentClickListener = null;
                                }
                                
                                // Remove any existing tooltip
                                const existingTooltip = document.querySelector('.ds-lint-tooltip');
                                if (existingTooltip) {
                                    existingTooltip.remove();
                                }
                                
                                // Clean up tooltip event listeners
                                if (window.dsLint && window.dsLint.currentTooltip) {
                                    window.removeEventListener('resize', window.dsLint.currentTooltip.repositionHandler);
                                    window.removeEventListener('scroll', window.dsLint.currentTooltip.repositionHandler);
                                    window.dsLint.currentTooltip = null;
                                }
                                
                                // Also call the content script's clearHighlight function if available
                                if (window.dsLint && window.dsLint.clearHighlight) {
                                    window.dsLint.clearHighlight();
                                }
                                
                                // Create a highlight overlay that doesn't affect layout
                                const highlightOverlay = document.createElement('div');
                                highlightOverlay.className = 'ds-lint-highlight-overlay';
                                
                                // Get the computed border-radius to match it
                                const computedStyle = window.getComputedStyle(element);
                                const borderRadius = computedStyle.borderRadius;
                                
                                highlightOverlay.style.cssText = \`
                                    position: absolute;
                                    top: -2px;
                                    left: -2px;
                                    right: -2px;
                                    bottom: -2px;
                                    border: 2px solid #FF3B30;
                                    border-radius: \${borderRadius !== '0px' ? \`calc(\${borderRadius} + 2px)\` : '2px'};
                                    pointer-events: none;
                                    z-index: 9999;
                                    animation: ds-lint-pulse 2s ease-in-out infinite;
                                \`;
                                
                                // Add pulse animation keyframes if not already present
                                if (!document.querySelector('#ds-lint-pulse-styles')) {
                                    const style = document.createElement('style');
                                    style.id = 'ds-lint-pulse-styles';
                                    style.textContent = \`
                                        @keyframes ds-lint-pulse {
                                            0% {
                                                border-width: 2px;
                                                box-shadow: 0 0 15px rgba(255, 59, 48, 0.6);
                                            }
                                            50% {
                                                border-width: 4px;
                                                box-shadow: 0 0 25px rgba(255, 59, 48, 0.8);
                                            }
                                            100% {
                                                border-width: 2px;
                                                box-shadow: 0 0 15px rgba(255, 59, 48, 0.6);
                                            }
                                        }
                                    \`;
                                    document.head.appendChild(style);
                                }
                                
                                // Ensure the element has position relative for the overlay to work
                                const originalPosition = element.style.position;
                                const computedPosition = window.getComputedStyle(element).position;
                                
                                if (computedPosition === 'static') {
                                    element.style.position = 'relative';
                                }
                                element.style.zIndex = '9999';
                                
                                // Add the overlay to the element
                                element.appendChild(highlightOverlay);
                                element.classList.add('ds-lint-highlight');
                                
                                // Store references for cleanup
                                element.highlightOverlay = highlightOverlay;
                                element.originalPosition = originalPosition;
                                
                                // Add click event listener to clear highlight when clicking outside
                                const clearHighlightOnClickOutside = (e) => {
                                    // Check if the clicked element is within a highlighted element or tooltip
                                    const isWithinHighlighted = e.target.closest('.ds-lint-highlight') || 
                                                               e.target.closest('.ds-lint-highlight-overlay') ||
                                                               e.target.closest('.ds-lint-tooltip') ||
                                                               e.target.classList.contains('ds-lint-highlight') ||
                                                               e.target.classList.contains('ds-lint-highlight-overlay') ||
                                                               e.target.classList.contains('ds-lint-tooltip');
                                    
                                    if (!isWithinHighlighted) {
                                        // Remove the highlight overlay
                                        if (element.highlightOverlay && element.highlightOverlay.parentNode) {
                                            element.highlightOverlay.parentNode.removeChild(element.highlightOverlay);
                                        }
                                        
                                        // Restore original styles
                                        if (element.originalPosition !== undefined) {
                                            element.style.position = element.originalPosition;
                                        } else {
                                            element.style.removeProperty('position');
                                        }
                                        element.style.removeProperty('z-index');
                                        
                                        element.classList.remove('ds-lint-highlight');
                                        element.highlightOverlay = null;
                                        element.originalPosition = null;
                                        
                                        // Remove tooltip
                                        const existingTooltip = document.querySelector('.ds-lint-tooltip');
                                        if (existingTooltip) {
                                            existingTooltip.remove();
                                        }
                                        
                                        // Clean up tooltip event listeners
                                        if (window.dsLint && window.dsLint.currentTooltip) {
                                            window.removeEventListener('resize', window.dsLint.currentTooltip.repositionHandler);
                                            window.removeEventListener('scroll', window.dsLint.currentTooltip.repositionHandler);
                                            window.dsLint.currentTooltip = null;
                                        }
                                        
                                        // Remove this event listener
                                        document.removeEventListener('click', clearHighlightOnClickOutside);
                                        window.dsLint.currentClickListener = null;
                                    }
                                };
                                
                                // Store the click event listener reference for cleanup
                                window.dsLint = window.dsLint || {};
                                window.dsLint.currentClickListener = clearHighlightOnClickOutside;
                                
                                // Add the click event listener
                                document.addEventListener('click', clearHighlightOnClickOutside);
                                
                                // Scroll to element
                                element.scrollIntoView({ 
                                    behavior: 'smooth', 
                                    block: 'center',
                                    inline: 'center'
                                });
                                
                                // Remove highlight after 30 seconds
                                setTimeout(() => {
                                    if (element.classList.contains('ds-lint-highlight')) {
                                        // Remove the highlight overlay
                                        if (element.highlightOverlay && element.highlightOverlay.parentNode) {
                                            element.highlightOverlay.parentNode.removeChild(element.highlightOverlay);
                                        }
                                        
                                        // Restore original styles
                                        if (element.originalPosition !== undefined) {
                                            element.style.position = element.originalPosition;
                                        } else {
                                            element.style.removeProperty('position');
                                        }
                                        element.style.removeProperty('z-index');
                                        
                                        element.classList.remove('ds-lint-highlight');
                                        element.highlightOverlay = null;
                                        element.originalPosition = null;
                                        
                                        // Remove click event listener
                                        if (window.dsLint && window.dsLint.currentClickListener) {
                                            document.removeEventListener('click', window.dsLint.currentClickListener);
                                            window.dsLint.currentClickListener = null;
                                        }
                                    }
                                }, 30000);
                            }
                        })('${escapeString(itemData.elementId)}', '${escapeString(itemData.selector || '')}', '${escapeString(itemData.path || '')}')
                    `;
                    
                    chrome.devtools.inspectedWindow.eval(highlightScript);
                } else {
                    // Fall back to content script
                    chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, files: ['content/content.js'] }).then(() => {
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabs[0].id, { 
                                action: 'inspectElement', 
                                elementId: card.dataset.elementId,
                                issueData: itemData
                            });
                        }, 50);
                    }).catch(err => {
                        console.error('Token Inspector Panel: Fallback content script injection failed:', err);
                    });
                }
            });
        });
        
        // Add editing functionality
        setupEditingHandlers(card, itemData);
        
        return card;
    }

    /**
     * Format CSS value for display
     * Preserves original format (hex vs rgba)
     * 
     * @param {string} value - CSS value to format
     * @returns {string} Formatted value
     */
    function formatCssValue(value) {
        // Return the original value as-is to preserve the CSS format
        // This ensures hex values stay hex, rgb values stay rgb, etc.
        return value;
    }

    /**
     * Setup editing handlers for an issue card
     * 
     * @param {HTMLElement} card - The issue card element
     * @param {Object} itemData - The issue data
     */
    function setupEditingHandlers(card, itemData) {
        const valueElement = card.querySelector('.issue-value-editable');
        const editControls = card.querySelector('.edit-controls');
        const applyButton = card.querySelector('.apply-button');
        const cancelButton = card.querySelector('.cancel-button');
        const statusElement = card.querySelector('.edit-status');
        
        let originalValue = itemData.value;
        let isEditing = false;
        
        // Handle value element click to start editing
        valueElement.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent card click
            
            if (!isEditing) {
                startEditing();
            }
        });
        
        // Handle apply button click
        applyButton.addEventListener('click', (event) => {
            event.stopPropagation();
            applyChanges();
        });
        
        // Handle cancel button click
        cancelButton.addEventListener('click', (event) => {
            event.stopPropagation();
            cancelEditing();
        });
        
        // Handle Enter key in edit mode
        valueElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                applyChanges();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelEditing();
            }
        });
        
        function startEditing() {
            isEditing = true;
            valueElement.contentEditable = true;
            valueElement.classList.add('editing');
            editControls.classList.add('visible');
            applyButton.disabled = false;
            statusElement.textContent = '';
            statusElement.className = 'edit-status';
            
            // Focus and select all text
            valueElement.focus();
            const range = document.createRange();
            range.selectNodeContents(valueElement);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        function cancelEditing() {
            isEditing = false;
            valueElement.contentEditable = false;
            valueElement.classList.remove('editing');
            editControls.classList.remove('visible');
            valueElement.textContent = formatCssValue(originalValue);
            statusElement.textContent = '';
        }
        
        function applyChanges() {
            const newValue = valueElement.textContent.trim();
            
            if (!newValue) {
                statusElement.textContent = 'Value cannot be empty';
                statusElement.className = 'edit-status error';
                return;
            }
            
            // Validate CSS value format
            if (!isValidCssValue(newValue, itemData.property)) {
                statusElement.textContent = 'Invalid CSS value format';
                statusElement.className = 'edit-status error';
                return;
            }
            
            // Apply the change to the web page
            applyCssChange(itemData, newValue)
                .then(() => {
                    // Update the original value
                    originalValue = newValue;
                    itemData.value = newValue;
                    
                    // Exit edit mode
                    isEditing = false;
                    valueElement.contentEditable = false;
                    valueElement.classList.remove('editing');
                    editControls.classList.remove('visible');
                    valueElement.textContent = formatCssValue(newValue);
                    
                    // Show success message
                    statusElement.textContent = 'Applied successfully';
                    statusElement.className = 'edit-status';
                    
                    // Clear success message after 2 seconds
                    setTimeout(() => {
                        statusElement.textContent = '';
                    }, 2000);
                })
                .catch((error) => {
                    statusElement.textContent = 'Failed to apply: ' + error.message;
                    statusElement.className = 'edit-status error';
                });
        }
    }

    /**
     * Validate CSS value format
     * 
     * @param {string} value - The CSS value to validate
     * @param {string} property - The CSS property name
     * @returns {boolean} Whether the value is valid
     */
    function isValidCssValue(value, property) {
        // Basic validation for common CSS properties
        const propertyLower = property.toLowerCase();
        
        // CSS Custom Properties (variables) - always valid
        if (/^var\(--[a-zA-Z0-9_-]+(?:,\s*[^)]+)?\)$/.test(value)) return true;
        
        // Color values
        if (propertyLower.includes('color') || propertyLower.includes('background')) {
            // Hex colors
            if (/^#[0-9A-Fa-f]{3,6}$/.test(value)) return true;
            // RGB/RGBA colors
            if (/^rgba?\([^)]+\)$/.test(value)) return true;
            // Named colors
            if (/^[a-zA-Z]+$/.test(value)) return true;
            // HSL/HSLA colors
            if (/^hsla?\([^)]+\)$/.test(value)) return true;
            return false;
        }
        
        // Numeric values with units
        if (propertyLower.includes('width') || propertyLower.includes('height') || 
            propertyLower.includes('margin') || propertyLower.includes('padding') ||
            propertyLower.includes('border') || propertyLower.includes('font-size')) {
            // Numbers with units (px, em, rem, %, etc.)
            if (/^[\d.]+(px|em|rem|%|vh|vw|pt|cm|mm|in)$/.test(value)) return true;
            // Just numbers (for some properties)
            if (/^[\d.]+$/.test(value)) return true;
            return false;
        }
        
        // Font weight
        if (propertyLower.includes('font-weight')) {
            if (/^[\d]+$/.test(value) || /^(normal|bold|bolder|lighter)$/.test(value)) return true;
            return false;
        }
        
        // Line height
        if (propertyLower.includes('line-height')) {
            if (/^[\d.]+$/.test(value) || /^[\d.]+(px|em|rem|%)$/.test(value) || /^normal$/.test(value)) return true;
            return false;
        }
        
        // Default: accept any non-empty string
        return value.length > 0;
    }

    /**
     * Apply CSS change to the web page
     * 
     * @param {Object} itemData - The issue data
     * @param {string} newValue - The new CSS value
     * @returns {Promise} Promise that resolves when the change is applied
     */
    function applyCssChange(itemData, newValue) {
        return new Promise((resolve, reject) => {
            if (chrome.devtools && chrome.devtools.inspectedWindow) {
                // Create the script with proper parameter passing and escape special characters
                const escapeString = (str) => {
                    if (!str) return '';
                    return str.replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                };
                
                const script = `
                    (function(elementId, selector, path, property, originalValue, newValue) {
                        try {
                            // Try multiple ways to find the element
                            let element = document.querySelector('[data-ds-lint-id="' + elementId + '"]');
                            
                            // If not found by data attribute, try by selector
                            if (!element && selector) {
                                try {
                                    element = document.querySelector(selector);
                                } catch (e) {
                                    // Invalid selector, continue
                                }
                            }
                            
                            // If still not found, try to find by path
                            if (!element && path) {
                                const pathParts = path.split(' › ');
                                if (pathParts.length > 0) {
                                    try {
                                        element = document.querySelector(pathParts[pathParts.length - 1]);
                                    } catch (e) {
                                        // Invalid path selector, continue
                                    }
                                }
                            }
                            
                            if (element) {
                                // Apply the CSS change
                                element.style.setProperty(property, newValue, 'important');
                                
                                // Store the change for potential reversion
                                if (!window.dsLint) window.dsLint = {};
                                if (!window.dsLint.appliedChanges) window.dsLint.appliedChanges = [];
                                
                                window.dsLint.appliedChanges.push({
                                    elementId: elementId,
                                    property: property,
                                    originalValue: originalValue,
                                    newValue: newValue,
                                    timestamp: Date.now()
                                });
                                
                                return { success: true, message: 'CSS change applied successfully' };
                            } else {
                                return { success: false, message: 'Element not found' };
                            }
                        } catch (error) {
                            return { success: false, message: error.message };
                        }
                    })('${escapeString(itemData.elementId)}', '${escapeString(itemData.selector || '')}', '${escapeString(itemData.path || '')}', '${escapeString(itemData.property)}', '${escapeString(itemData.value)}', '${escapeString(newValue)}')
                `;
                
                chrome.devtools.inspectedWindow.eval(script, (result, isException) => {
                    if (isException) {
                        reject(new Error('Failed to execute script: ' + isException.value));
                    } else if (result && result.success) {
                        resolve(result);
                    } else {
                        reject(new Error(result ? result.message : 'Unknown error'));
                    }
                });
            } else {
                // Fall back to content script messaging
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs.length > 0) {
                        chrome.tabs.sendMessage(tabs[0].id, { 
                            action: 'applyCssChange',
                            elementId: itemData.elementId,
                            property: itemData.property,
                            newValue: newValue,
                            selector: itemData.selector,
                            path: itemData.path
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error('Failed to send message: ' + chrome.runtime.lastError.message));
                            } else if (response && response.success) {
                                resolve(response);
                            } else {
                                reject(new Error(response ? response.message : 'Unknown error'));
                            }
                        });
                    } else {
                        reject(new Error('No active tab found'));
                    }
                });
            }
        });
    }



    /**
     * Clear highlight from the page
     * Removes all visual indicators and cleans up event listeners
     */
    function clearHighlight() {
        if (chrome.devtools && chrome.devtools.inspectedWindow) {
            // Use DevTools API to clear highlight
            chrome.devtools.inspectedWindow.eval(`
                (function() {
                    // Clear any highlighted elements
                    const highlightedElements = document.querySelectorAll('.ds-lint-highlight');
                    highlightedElements.forEach(element => {
                        // Remove the highlight overlay
                        if (element.highlightOverlay && element.highlightOverlay.parentNode) {
                            element.highlightOverlay.parentNode.removeChild(element.highlightOverlay);
                        }
                        
                        // Restore original styles
                        if (element.originalPosition !== undefined) {
                            element.style.position = element.originalPosition;
                        } else {
                            element.style.removeProperty('position');
                        }
                        element.style.removeProperty('z-index');
                        
                        element.classList.remove('ds-lint-highlight');
                        element.highlightOverlay = null;
                        element.originalPosition = null;
                    });
                    
                    // Remove click event listener
                    if (window.dsLint && window.dsLint.currentClickListener) {
                        document.removeEventListener('click', window.dsLint.currentClickListener);
                        window.dsLint.currentClickListener = null;
                    }
                    
                    // Remove tooltip
                    const existingTooltip = document.querySelector('.ds-lint-tooltip');
                    if (existingTooltip) {
                        existingTooltip.remove();
                    }
                    
                    // Clean up tooltip event listeners
                    if (window.dsLint && window.dsLint.currentTooltip) {
                        window.removeEventListener('resize', window.dsLint.currentTooltip.repositionHandler);
                        window.removeEventListener('scroll', window.dsLint.currentTooltip.repositionHandler);
                        window.dsLint.currentTooltip = null;
                    }
                    
                    // Also call the content script's clearHighlight function if available
                    if (window.dsLint && window.dsLint.clearHighlight) {
                        window.dsLint.clearHighlight();
                    }
                    
                    // Remove pulse animation styles
                    const pulseStyles = document.querySelector('#ds-lint-pulse-styles');
                    if (pulseStyles) {
                        pulseStyles.remove();
                    }
                })()
            `);
        } else {
            // Fall back to content script messaging
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'clearHighlight' });
                }
            });
        }
        
        // Clear selected state in the panel
        selectedElementId = null;
        updateItemSelection();
    }

    /**
     * Add click event listener for the scan button
     * Resets UI state and starts a new scan
     */
    if (scanButton) {
        scanButton.addEventListener('click', () => {
            startScan();
        });
    }



    /**
     * Add click event listener for the clear highlight button
     * Removes all highlights from the page
     */
    if (clearHighlightButton) {
        clearHighlightButton.addEventListener('click', () => {
            // Add visual feedback
            clearHighlightButton.textContent = 'Cleared!';
            clearHighlightButton.style.background = '#6a9955';
            clearHighlightButton.style.color = '#ffffff';
            
            clearHighlight();
            
            // Reset button after 1 second
            setTimeout(() => {
                clearHighlightButton.textContent = 'Clear Highlight';
                clearHighlightButton.style.background = '';
                clearHighlightButton.style.color = '';
            }, 1000);
        });
    }

    /**
     * Add keyboard shortcut for clearing highlights (Escape key)
     */
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            clearHighlight();
        }
    });

    // Start scanning automatically when panel opens
    startScan();
}); 