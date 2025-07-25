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
 * @version 1.3
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
            <span class="issue-value">${formattedValue}</span>
            <span class="issue-semicolon">;</span>
            <br>
            <span class="issue-brace">}</span>
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
                    chrome.devtools.inspectedWindow.eval(`
                        (function() {
                            // Try multiple ways to find the element
                            let element = document.querySelector('[data-ds-lint-id="${itemData.elementId}"]');
                            
                            // If not found by data attribute, try by selector
                            if (!element && itemData.selector) {
                                try {
                                    element = document.querySelector(itemData.selector);
                                } catch (e) {
                                    // Invalid selector, continue
                                }
                            }
                            
                            // If still not found, try to find by path
                            if (!element && itemData.path) {
                                const pathParts = itemData.path.split(' › ');
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
                                    el.style.outline = '';
                                    el.style.boxShadow = '';
                                    el.style.animation = '';
                                    el.style.zIndex = '';
                                    el.style.position = '';
                                    el.classList.remove('ds-lint-highlight');
                                });
                                
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
                                
                                // Add highlight
                                element.style.outline = '2px solid #FF3B30';
                                element.style.boxShadow = '0 0 15px rgba(255, 59, 48, 0.6)';
                                element.style.animation = 'ds-lint-pulse 2s ease-in-out infinite';
                                
                                // Add pulse animation keyframes if not already present
                                if (!document.querySelector('#ds-lint-pulse-styles')) {
                                    const style = document.createElement('style');
                                    style.id = 'ds-lint-pulse-styles';
                                    style.textContent = \`
                                        @keyframes ds-lint-pulse {
                                            0% {
                                                outline-width: 2px;
                                                box-shadow: 0 0 15px rgba(255, 59, 48, 0.6);
                                            }
                                            50% {
                                                outline-width: 4px;
                                                box-shadow: 0 0 25px rgba(255, 59, 48, 0.8);
                                            }
                                            100% {
                                                outline-width: 2px;
                                                box-shadow: 0 0 15px rgba(255, 59, 48, 0.6);
                                            }
                                        }
                                    \`;
                                    document.head.appendChild(style);
                                }
                                element.style.zIndex = '9999';
                                element.style.position = 'relative';
                                element.classList.add('ds-lint-highlight');
                                
                                // Scroll to element
                                element.scrollIntoView({ 
                                    behavior: 'smooth', 
                                    block: 'center',
                                    inline: 'center'
                                });
                                
                                // Remove highlight after 30 seconds
                                setTimeout(() => {
                                    if (element.classList.contains('ds-lint-highlight')) {
                                        element.style.outline = '';
                                        element.style.boxShadow = '';
                                        element.style.animation = '';
                                        element.style.zIndex = '';
                                        element.style.position = '';
                                        element.classList.remove('ds-lint-highlight');
                                    }
                                }, 30000);
                            }
                        })()
                    `);
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
                        element.style.outline = '';
                        element.style.boxShadow = '';
                        element.style.animation = '';
                        element.style.zIndex = '';
                        element.style.position = '';
                        element.classList.remove('ds-lint-highlight');
                    });
                    
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