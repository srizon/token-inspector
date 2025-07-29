/**
 * Token Inspector Popup Script
 * 
 * This script manages the popup interface for the Token Inspector extension.
 * It provides a user-friendly interface for scanning web pages and viewing results.
 * 
 * Key Features:
 * - Automatic scanning when popup opens
 * - Category-based result filtering
 * - Element highlighting on click
 * - Real-time scan status updates
 * - Responsive UI with loading states
 * 
 * @version 2.0
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup DOM loaded');
    console.log('Lottie library status:', typeof lottie);
    
    // UI Elements
    const scannerState = document.getElementById('scanner-state');
    const resultsContainer = document.getElementById('results-container');
    const noResultsMessage = document.getElementById('no-results-message');
    const categoryTabs = document.getElementById('category-tabs');
    const lottieContainer = document.getElementById('lottie-container');
    
    // State Management
    let allResults = {};
    let currentCategory = 'all';
    let selectedElementId = null; // Track the currently selected element
    let lottieAnimation = null; // Lottie animation instance

    /**
     * Initialize Lottie animation
     * Loads and plays the scanning animation
     */
    function initLottieAnimation() {
        // Check if Lottie library is available
        if (typeof lottie === 'undefined') {
            console.error('Lottie library not loaded');
            lottieContainer.innerHTML = '<div style="width: 20px; height: 20px; border: 2px solid #e5e5e5; border-top: 2px solid #0a0a0a; border-radius: 50%; animation: spin 1s linear infinite;"></div>';
            return;
        }
        
        if (lottieAnimation) {
            lottieAnimation.destroy();
        }
        
        const lottieUrl = chrome.runtime.getURL('lottie/lottie_scanning.json');
        console.log('Loading Lottie animation from:', lottieUrl);
        
        // Test if the file exists by making a fetch request
        fetch(lottieUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Lottie JSON file loaded successfully');
                
                lottieAnimation = lottie.loadAnimation({
                    container: lottieContainer,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    path: lottieUrl
                });
                
                lottieAnimation.addEventListener('data_ready', () => {
                    console.log('Lottie animation loaded successfully');
                    // Check if we should start the animation immediately
                    if (window.shouldStartLottieWhenReady) {
                        console.log('Starting Lottie animation now that it\'s ready');
                        lottieAnimation.play();
                        window.shouldStartLottieWhenReady = false;
                    }
                }, { once: true }); // Use once: true to prevent multiple listeners
                
                lottieAnimation.addEventListener('error', (error) => {
                    console.error('Lottie animation error:', error);
                    // Fallback to a simple loading indicator if Lottie fails
                    lottieContainer.innerHTML = '<div style="width: 20px; height: 20px; border: 2px solid #e5e5e5; border-top: 2px solid #0a0a0a; border-radius: 50%; animation: spin 1s linear infinite;"></div>';
                });
            })
            .catch(error => {
                console.error('Failed to load Lottie JSON file:', error);
                // Fallback to a simple loading indicator
                lottieContainer.innerHTML = '<div style="width: 20px; height: 20px; border: 2px solid #e5e5e5; border-top: 2px solid #0a0a0a; border-radius: 50%; animation: spin 1s linear infinite;"></div>';
            });
    }

    /**
     * Start Lottie animation
     */
    function startLottieAnimation() {
        console.log('Starting Lottie animation, animation instance:', lottieAnimation);
        
        if (lottieAnimation) {
            // Check if animation is already loaded
            if (lottieAnimation.isLoaded) {
                lottieAnimation.play();
            } else {
                // Animation is created but not yet loaded, wait for it
                lottieAnimation.addEventListener('data_ready', () => {
                    console.log('Lottie animation ready, playing now');
                    lottieAnimation.play();
                }, { once: true }); // Use once: true to prevent multiple listeners
            }
        } else {
            console.log('Lottie animation not initialized yet, will start when ready');
            // Store a flag to start animation when it's ready
            window.shouldStartLottieWhenReady = true;
        }
    }

    /**
     * Stop Lottie animation
     */
    function stopLottieAnimation() {
        if (lottieAnimation) {
            lottieAnimation.stop();
        }
    }

    /**
     * Initialize the shared scanner for popup
     * Configures callbacks for scan lifecycle events
     */
    const scanner = new TokenInspectorScanner({
        isDevTools: false,
        onScanStart: () => {
            scannerState.style.display = 'flex';
            resultsContainer.style.display = 'none';
            noResultsMessage.style.display = 'none';
            categoryTabs.style.display = 'none';
            startLottieAnimation();
        },
        onScanComplete: () => {
            scannerState.style.display = 'none';
            stopLottieAnimation();
        },
        onResultsReady: (results) => {
            displayResults(results);
        },
        onError: (error) => {
            console.error('Token Inspector Popup: Error:', error);
            scannerState.style.display = 'none';
            stopLottieAnimation();
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
            console.log('Token Inspector Popup: Content script is ready');
        }
    });

    /**
     * Display results with tab functionality (popup-specific)
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
        const summaryItems = categoryTabs.querySelectorAll('.summary-item');
        
        summaryItems.forEach(item => {
            item.addEventListener('click', () => {
                // Update active tab
                summaryItems.forEach(summaryItem => summaryItem.classList.remove('summary-item-highlighted'));
                item.classList.add('summary-item-highlighted');
                
                // Update current category and display
                currentCategory = item.dataset.category;
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
        const allItems = document.querySelectorAll('.item');
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
        section.className = 'section';

        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = `<div class="section-title">${category}</div><div class="section-count">${items.length}</div>`;

        section.appendChild(header);

        for (const itemData of items) {
            const item = createIssueItem(itemData, category);
            section.appendChild(item);
        }

        return section;
    }

    /**
     * Create an issue item with click handling and highlighting
     * 
     * @param {Object} itemData - Issue data
     * @param {string} category - Category name
     * @returns {HTMLElement} Issue item element
     */
    function createIssueItem(itemData, category) {
        const item = document.createElement('div');
        item.className = 'item';
        item.dataset.elementId = itemData.elementId;
        
        // Check if this item should be selected
        if (selectedElementId === itemData.elementId) {
            item.classList.add('selected');
        }
        
        // Determine icon type and value class based on category
        const iconType = getIconType(itemData, category);
        const valueClass = getValueClass(itemData, category);

        // Format the value to show the original format (hex vs rgba)
        const formattedValue = formatCssValue(itemData.value);

        // Get the SVG icon content
        const iconSvg = getIconSvg(iconType);

        // Create the content using createElement instead of innerHTML to preserve event listeners
        const iconContainer = document.createElement('div');
        iconContainer.className = `icon-container ${iconType}`;
        iconContainer.innerHTML = iconSvg;
        
        const itemContent = document.createElement('div');
        itemContent.className = 'item-content';
        itemContent.innerHTML = `
            <div class="item-title">${itemData.selector}</div>
            <div class="item-details">
                <div class="item-detail">
                    <span class="detail-label">${itemData.property}:</span>
                    <span class="detail-value ${valueClass}">${formattedValue}</span>
                </div>
                <div class="item-element">${formatPathWithCaret(itemData.path)}</div>
            </div>
        `;
        
        item.appendChild(iconContainer);
        item.appendChild(itemContent);

        // Add click handler for element highlighting
        item.addEventListener('click', (event) => {
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
                                // Clear previous highlight
                                const prevHighlight = document.querySelector('.ds-lint-highlight');
                                if (prevHighlight) {
                                    prevHighlight.style.outline = '';
                                    prevHighlight.style.boxShadow = '';
                                    prevHighlight.style.backgroundColor = '';
                                    prevHighlight.style.zIndex = '';
                                    prevHighlight.style.position = '';
                                    prevHighlight.classList.remove('ds-lint-highlight');
                                }
                                
                                // Also clear any existing highlight from content script
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
                                elementId: item.dataset.elementId,
                                issueData: itemData
                            });
                        }, 50);
                    }).catch(err => {
                        console.error('Token Inspector Popup: Fallback content script injection failed:', err);
                    });
                }
            });
        });
        return item;
    }

    /**
     * Determine icon type based on issue data and category
     * 
     * @param {Object} itemData - Issue data
     * @param {string} category - Category name
     * @returns {string} Icon type identifier
     */
    function getIconType(itemData, category) {
        // Use the passed category parameter first, then fall back to property-based detection
        if (category === 'Colors' || itemData.category === 'Colors' || itemData.property.includes('Color')) {
            return 'icon-color';
        } else if (category === 'Typography' || itemData.category === 'Typography' || itemData.property.includes('Font') || itemData.property.includes('Line')) {
            return 'icon-font';
        } else if (category === 'Spacing' || itemData.category === 'Spacing' || itemData.property.includes('Margin') || itemData.property.includes('Padding')) {
            return 'icon-spacing';
        } else if (category === 'Border' || itemData.category === 'Border' || itemData.property.includes('Border')) {
            return 'icon-border';
        }
        return 'icon-color'; // Default
    }

    /**
     * Determine CSS class for value styling based on category
     * 
     * @param {Object} itemData - Issue data
     * @param {string} category - Category name
     * @returns {string} CSS class name
     */
    function getValueClass(itemData, category) {
        if (category === 'Colors' || itemData.category === 'Colors' || itemData.property.includes('Color')) {
            return 'color-value';
        } else if (category === 'Typography' || itemData.category === 'Typography' || itemData.property.includes('Font') || itemData.property.includes('Line')) {
            return 'font-value';
        } else if (category === 'Spacing' || itemData.category === 'Spacing' || itemData.property.includes('Margin') || itemData.property.includes('Padding')) {
            return 'spacing-value';
        } else if (category === 'Border' || itemData.category === 'Border' || itemData.property.includes('Border')) {
            return 'border-value';
        }
        return 'color-value'; // Default
    }

    /**
     * Get SVG icon content for the specified icon type
     * 
     * @param {string} iconType - Icon type identifier
     * @returns {string} HTML string with icon element
     */
    function getIconSvg(iconType) {
        // Map icon types to their corresponding asset files
        const iconMap = {
            'icon-color': 'assets/icon-color.svg',
            'icon-font': 'assets/icon-text.svg',
            'icon-spacing': 'assets/icon-spacing.svg',
            'icon-border': 'assets/icon-border.svg'
        };
        
        const iconPath = iconMap[iconType] || iconMap['icon-color'];
        const fullUrl = chrome.runtime.getURL(iconPath);
        
        // Return an img element that loads the SVG file with error handling and fallback
        return `<img src="${fullUrl}" width="24" height="24" style="display: block;" alt="${iconType}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><div style="display:none; width:24px; height:24px; background-color: #8D62F1; border-radius: 50%;"></div>`;
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
     * Format element path with caret icons
     * 
     * @param {string} path - Element path string
     * @returns {string} Formatted path with caret icons
     */
    function formatPathWithCaret(path) {
        if (!path) return '';
        
        // Simply replace the separator with the caret icon
        const caretIconUrl = chrome.runtime.getURL('assets/icon-caret.svg');
        const caretIcon = `<img src="${caretIconUrl}" class="caret-icon" alt=">" onerror="this.style.display='none';">`;
        
        return path.replace(/ › /g, caretIcon);
    }

    /**
     * Add click event listener for the scan button
     * Resets UI state and starts a new scan
     */
    const scanButton = document.querySelector('.header-scan');
    if (scanButton) {
        scanButton.addEventListener('click', () => {
            // Reset UI state
            scannerState.style.display = 'flex';
            resultsContainer.style.display = 'none';
            noResultsMessage.style.display = 'none';
            categoryTabs.style.display = 'none';
            
            // Clear previous results and selection
            allResults = {};
            currentCategory = 'all';
            selectedElementId = null;
            
            // Start Lottie animation and new scan
            startLottieAnimation();
            scanner.startScan();
        });
    }

    /**
     * Add click event listener for the settings button
     * Navigates to the settings page
     */
    const settingsButton = document.querySelector('.header-settings');
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            window.location.href = 'settings.html';
        });
    }



    // Wait for Lottie library to be available
    let lottieWaitAttempts = 0;
    const maxLottieWaitAttempts = 20; // 1 second max wait
    
    function waitForLottie() {
        if (typeof lottie !== 'undefined') {
            console.log('Lottie library is available, initializing animation...');
            initLottieAnimation();
        } else if (lottieWaitAttempts < maxLottieWaitAttempts) {
            lottieWaitAttempts++;
            console.log(`Lottie library not yet available, retrying... (${lottieWaitAttempts}/${maxLottieWaitAttempts})`);
            setTimeout(waitForLottie, 50);
        } else {
            console.error('Lottie library failed to load after maximum attempts');
            // Fallback to spinner
            lottieContainer.innerHTML = '<div style="width: 20px; height: 20px; border: 2px solid #e5e5e5; border-top: 2px solid #0a0a0a; border-radius: 50%; animation: spin 1s linear infinite;"></div>';
        }
    }
    
    // Start waiting for Lottie library
    waitForLottie();
    
    // Start scanning automatically when popup opens
    scanner.startScan();
});