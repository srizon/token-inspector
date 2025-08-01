/**
 * Shared Token Inspector Scanner Logic
 * 
 * This module contains the common functionality used by both popup and devtools panels.
 * It provides a unified interface for scanning web pages for design token violations.
 * 
 * The scanner identifies:
 * - Hardcoded color values (hex, rgb, hsl)
 * - Hardcoded typography values (font-size, font-weight, line-height)
 * - Hardcoded spacing values (margin, padding)
 * - Hardcoded border values (border-radius)
 * - Flagged CSS variables that should be replaced
 * 
 * @class TokenInspectorScanner
 * @version 2.0
 */
class TokenInspectorScanner {
    /**
     * Initialize the scanner with configuration options
     * 
     * @param {Object} options - Configuration options
     * @param {boolean} options.isDevTools - Whether running in DevTools context
     * @param {Function} options.onResultsReady - Callback when results are available
     * @param {Function} options.onScanStart - Callback when scan starts
     * @param {Function} options.onScanComplete - Callback when scan completes
     * @param {Function} options.onError - Callback when errors occur
     */
    constructor(options = {}) {
        this.isDevTools = options.isDevTools || false;
        this.onResultsReady = options.onResultsReady || (() => {});
        this.onScanStart = options.onScanStart || (() => {});
        this.onScanComplete = options.onScanComplete || (() => {});
        this.onError = options.onError || (() => {});
    }

    /**
     * Start the scanning process
     * Determines whether to use DevTools API or content script based on context
     */
    startScan() {
        this.onScanStart();
        
        if (this.isDevTools) {
            this.scanWithDevTools();
        } else {
            this.scanWithContentScript();
        }
    }

    /**
     * Scan using DevTools API (for devtools panel)
     * Injects content script and communicates via Chrome DevTools API
     */
    scanWithDevTools() {
        console.log('Token Inspector DevTools: Starting scan...');
        
        // First, check if we can access the current tab
        chrome.tabs.get(chrome.devtools.inspectedWindow.tabId, (tab) => {
            if (chrome.runtime.lastError) {
                console.warn('Token Inspector DevTools: Cannot access tab:', chrome.runtime.lastError.message);
                this.onError(new Error('Cannot access tab: ' + chrome.runtime.lastError.message));
                return;
            }

            // Check if the URL is injectable
            const url = tab.url || '';
            if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('devtools://')) {
                console.warn('Token Inspector DevTools: Cannot inject into restricted URL:', url);
                this.onError(new Error('Cannot inject into restricted URL: ' + url));
                return;
            }

            // Use the same approach as popup - inject content script and send message
            chrome.scripting.executeScript({
                target: { tabId: chrome.devtools.inspectedWindow.tabId },
                files: ['content/content.js']
            }).then(() => {
                console.log('Token Inspector DevTools: Content script injected, sending runScan message...');
                
                // Wait a bit for the script to initialize, then send message
                setTimeout(() => {
                    chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, { action: 'runScan' })
                        .then(response => {
                            console.log('Token Inspector DevTools: Scan message sent, response:', response);
                            if (response && response.success && response.results) {
                                // Results received immediately
                                this.onScanComplete();
                                this.onResultsReady(response.results);
                            } else {
                                // Wait for async results via message listener
                                console.log('Token Inspector DevTools: Waiting for async scan results...');
                            }
                        })
                        .catch(err => {
                            console.error('Token Inspector DevTools: Error sending scan message:', err);
                            this.onError(err);
                        });
                }, 200); // Increased wait time for content script initialization
            }).catch(err => {
                console.log('Token Inspector DevTools: Content script injection failed:', err);
                this.onError(err);
            });
        });
    }

    /**
     * Scan using content script (for popup)
     * Injects content script into the active tab and communicates via messaging
     */
    scanWithContentScript() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                this.onError('No active tab found');
                return;
            }
            
            const tabId = tabs[0].id;
            const tab = tabs[0];
            
            // Check if the URL is injectable
            const url = tab.url || '';
            if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('devtools://')) {
                console.warn('Token Inspector Popup: Cannot inject into restricted URL:', url);
                this.onError(new Error('Cannot inject into restricted URL: ' + url));
                return;
            }
            
            // Inject content script and run scan
            chrome.scripting.executeScript({ 
                target: { tabId: tabId }, 
                files: ['content/content.js'] 
            }).then(() => {
                console.log('Token Inspector Popup: Content script injected successfully');
                
                // Wait a bit for the script to initialize
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { action: 'runScan' })
                        .then(response => {
                            console.log('Token Inspector Popup: Scan message sent, response:', response);
                            if (response && response.success && response.results) {
                                // Results received immediately
                                this.onScanComplete();
                                this.onResultsReady(response.results);
                            } else {
                                // Wait for async results via message listener
                                console.log('Token Inspector Popup: Waiting for async scan results...');
                            }
                        })
                        .catch(err => {
                            console.error('Token Inspector Popup: Error sending scan message:', err);
                            this.onError(err);
                        });
                }, 100);
            }).catch(err => {
                console.error('Token Inspector Popup: Content script injection failed:', err);
                this.onError(err);
            });
        });
    }

    /**
     * Display results in the UI
     * Converts results to HTML elements and handles both array and object formats
     * 
     * @param {Object|Array} results - Scan results in object or array format
     * @param {HTMLElement} container - Container element to display results
     * @param {HTMLElement} noResultsElement - Element to show when no results found
     */
    displayResults(results, container, noResultsElement) {
        container.innerHTML = '';

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

        // Check if we have any results
        const totalIssues = Object.values(results).reduce((sum, items) => sum + items.length, 0);
        if (totalIssues === 0) {
            if (noResultsElement) {
                noResultsElement.style.display = 'flex';
            }
            return;
        }

        // Display all categories
        container.style.display = 'block';
        if (noResultsElement) {
            noResultsElement.style.display = 'none';
        }

        Object.keys(results).forEach(category => {
            const items = results[category];
            if (items.length > 0) {
                const section = this.createCategorySection(category, items);
                container.appendChild(section);
            }
        });
    }

    /**
     * Create a category section with collapsible header
     * 
     * @param {string} category - Category name (Colors, Typography, etc.)
     * @param {Array} items - Array of issue items for this category
     * @returns {HTMLElement} Category section element
     */
    createCategorySection(category, items) {
        const section = document.createElement('div');
        section.className = 'category-section';

        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `<span class="category-title">${category}</span><span class="category-count">${items.length}</span>`;

        const list = document.createElement('ul');
        list.className = 'results-list';

        items.forEach(itemData => {
            const card = this.createIssueCard(itemData);
            list.appendChild(card);
        });

        // Add click handler for collapsible functionality
        header.addEventListener('click', () => {
            const isHidden = list.style.display === 'none' || list.style.display === '';
            list.style.display = isHidden ? 'block' : 'none';
        });

        section.appendChild(header);
        section.appendChild(list);
        return section;
    }

    /**
     * Create an issue card for a single violation
     * 
     * @param {Object} itemData - Issue data containing selector, property, value, etc.
     * @returns {HTMLElement} Issue card element
     */
    createIssueCard(itemData) {
        const li = document.createElement('li');
        li.className = 'result-item-card';
        
        // Format the property name for display (convert kebab-case to Title Case)
        const propertyName = itemData.property.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        li.innerHTML = `
            <div class="item-header">
                <div class="item-selector" title="${itemData.selector}">${itemData.selector}</div>
            </div>
            <div class="item-properties">
                <span class="property-text">${propertyName}: ${itemData.value}</span>
            </div>
            <div class="item-path" title="${itemData.path}">${itemData.path}</div>
        `;

        // Add click handler to highlight element on page
        li.addEventListener('click', () => {
            this.highlightElement(itemData);
        });
        
        return li;
    }

    /**
     * Highlight element on the page using DevTools API or content script
     * 
     * @param {Object} itemData - Issue data containing elementId and other details
     */
    highlightElement(itemData) {
        if (this.isDevTools) {
            // Use DevTools API for highlighting
            chrome.devtools.inspectedWindow.eval(`
                (function() {
                    // Clear previous highlights
                    const prevHighlights = document.querySelectorAll('.ds-lint-highlight');
                    prevHighlights.forEach(el => {
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
                    
                    // Highlight the element
                    const element = document.querySelector('[data-ds-lint-id="${itemData.elementId}"]');
                    if (element) {
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
                            border: 2px solid #007AFF;
                            border-radius: \${borderRadius !== '0px' ? \`calc(\${borderRadius} + 2px)\` : '2px'};
                            pointer-events: none;
                            z-index: 9999;
                            animation: ds-lint-pulse-blue 2s ease-in-out infinite;
                        \`;
                        
                        // Add pulse animation keyframes if not already present
                        if (!document.querySelector('#ds-lint-pulse-blue-styles')) {
                            const style = document.createElement('style');
                            style.id = 'ds-lint-pulse-blue-styles';
                            style.textContent = \`
                                @keyframes ds-lint-pulse-blue {
                                    0% {
                                        border-width: 2px;
                                        box-shadow: 0 0 15px rgba(0, 122, 255, 0.6);
                                    }
                                    50% {
                                        border-width: 4px;
                                        box-shadow: 0 0 25px rgba(0, 122, 255, 0.8);
                                    }
                                    100% {
                                        border-width: 2px;
                                        box-shadow: 0 0 15px rgba(0, 122, 255, 0.6);
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
                        
                        // Show tooltip with issue details
                        const showTooltip = (element, issueData) => {
                            // Remove any existing tooltip
                            const existingTooltip = document.querySelector('.ds-lint-tooltip');
                            if (existingTooltip) {
                                existingTooltip.remove();
                            }

                            // Create tooltip element
                            const tooltip = document.createElement('div');
                            tooltip.className = 'ds-lint-tooltip';
                            tooltip.innerHTML = \`<span class="property">\${issueData.property}</span>: <span class="value">\${issueData.value}</span>\`;

                            // Add tooltip styles
                            tooltip.style.cssText = \`
                                position: fixed;
                                background: #1e1e1e;
                                border: 1px solid #3c3c3c;
                                border-radius: 4px;
                                padding: 6px 8px;
                                font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                                font-size: 12px;
                                line-height: 1.2;
                                z-index: 10000;
                                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                                pointer-events: none;
                                white-space: nowrap;
                            \`;

                            // Style the property (blue)
                            const propertySpan = tooltip.querySelector('.property');
                            propertySpan.style.cssText = \`
                                color: #9cdcfe;
                                font-weight: 500;
                            \`;

                            // Style the value (orange)
                            const valueSpan = tooltip.querySelector('.value');
                            valueSpan.style.cssText = \`
                                color: #ce9178;
                            \`;

                            // Add to document
                            document.body.appendChild(tooltip);

                            // Position tooltip
                            const positionTooltip = () => {
                                const rect = element.getBoundingClientRect();
                                const tooltipRect = tooltip.getBoundingClientRect();
                                
                                // Position at top-left corner of the element
                                let top = rect.top - tooltipRect.height - 8;
                                let left = rect.left;
                                
                                // If tooltip would go off the top, position below
                                if (top < 10) {
                                    top = rect.bottom + 8;
                                }
                                
                                // If tooltip would go off the left, adjust
                                if (left < 10) {
                                    left = 10;
                                }
                                
                                // If tooltip would go off the right, adjust
                                if (left + tooltipRect.width > window.innerWidth - 10) {
                                    left = window.innerWidth - tooltipRect.width - 10;
                                }
                                
                                tooltip.style.top = top + 'px';
                                tooltip.style.left = left + 'px';
                            };

                            // Position initially
                            positionTooltip();

                            // Reposition on window resize and scroll
                            const repositionHandler = () => positionTooltip();
                            window.addEventListener('resize', repositionHandler);
                            window.addEventListener('scroll', repositionHandler, { passive: true });

                            // Store reference for cleanup
                            window.dsLint = window.dsLint || {};
                            window.dsLint.currentTooltip = {
                                element: tooltip,
                                repositionHandler: repositionHandler
                            };
                        };

                        // Show tooltip with issue data
                        showTooltip(element, {
                            property: '${itemData.property}',
                            value: '${itemData.value}'
                        });
                        
                        // Scroll to element
                        element.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center',
                            inline: 'center'
                        });
                        
                        // Remove highlight and tooltip after 3 seconds
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
                            }
                        }, 3000);
                    }
                })()
            `);
        } else {
            // Use content script for highlighting
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, { 
                        action: 'inspectElement', 
                        elementId: itemData.elementId,
                        issueData: itemData
                    });
                }
            });
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TokenInspectorScanner;
} 