document.addEventListener('DOMContentLoaded', function() {
    const scanButton = document.getElementById('scan-button');
    const scannerState = document.getElementById('scanner-state');
    const resultsContainer = document.getElementById('results-container');
    const noResultsMessage = document.getElementById('no-results-message');
    const categoryTabs = document.getElementById('category-tabs');
    let allResults = {};
    let currentCategory = 'all';
    let scanInProgress = false;
    let contentScriptReady = false;

    // Initialize the shared scanner for devtools
    const scanner = new TokenInspectorScanner({
        isDevTools: true,
        onScanStart: () => {
            scanInProgress = true;
            scanButton.disabled = true;
            scannerState.style.display = 'flex';
            resultsContainer.style.display = 'none';
            noResultsMessage.style.display = 'none';
            categoryTabs.style.display = 'none';
        },
        onScanComplete: () => {
            scanInProgress = false;
            scanButton.disabled = false;
            scannerState.style.display = 'none';
        },
        onResultsReady: (results) => {
            displayResults(results);
        },
        onError: (error) => {
            console.error('Token Inspector DevTools: Error:', error);
            scanInProgress = false;
            scanButton.disabled = false;
            scannerState.style.display = 'none';
        }
    });

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'scanComplete') {
            console.log('Token Inspector DevTools: Received scan results:', request.results);
            scanner.onScanComplete();
            displayResults(request.results);
        } else if (request.type === 'contentScriptReady') {
            console.log('Token Inspector DevTools: Content script is ready');
            contentScriptReady = true;
        }
    });

    // Enhanced scanning function for devtools
    function performDevToolsScan() {
        if (scanInProgress) {
            console.log('Token Inspector DevTools: Scan already in progress, skipping...');
            return;
        }

        console.log('Token Inspector DevTools: Starting enhanced scan...');
        scanInProgress = true;
        scanButton.disabled = true;
        scannerState.style.display = 'flex';
        resultsContainer.style.display = 'none';
        noResultsMessage.style.display = 'none';
        categoryTabs.style.display = 'none';

        // First, ensure content script is injected
        chrome.scripting.executeScript({
            target: { tabId: chrome.devtools.inspectedWindow.tabId },
            files: ['content.js']
        }).then(() => {
            console.log('Token Inspector DevTools: Content script injected successfully');
            
            // Wait for content script to initialize and signal it's ready
            const waitForContentScript = () => {
                if (contentScriptReady) {
                    console.log('Token Inspector DevTools: Content script is ready, triggering scan...');
                    triggerScan();
                } else {
                    console.log('Token Inspector DevTools: Waiting for content script to be ready...');
                    setTimeout(waitForContentScript, 100);
                }
            };
            
            // Start waiting for content script
            setTimeout(waitForContentScript, 100);
            
            // Also try to trigger scan after a reasonable timeout
            setTimeout(() => {
                if (!contentScriptReady) {
                    console.log('Token Inspector DevTools: Content script timeout, trying scan anyway...');
                    triggerScan();
                }
            }, 3000);
            
        }).catch(err => {
            console.error('Token Inspector DevTools: Content script injection failed:', err);
            
            // Show user-friendly error message
            scannerState.innerHTML = `
                <div class="scanner-content">
                    <div style="color: #ff6b6b; margin-bottom: 10px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                    </div>
                    <p>Cannot scan this page</p>
                    <p style="font-size: 11px; color: #999; margin-top: 5px;">
                        This page cannot be scanned due to browser security restrictions.
                        Try opening a regular website (http:// or https://) instead of a local file.
                    </p>
                </div>
            `;
            
            scanInProgress = false;
            scanButton.disabled = false;
        });
    }

    function triggerScan() {
        console.log('Token Inspector DevTools: Triggering scan...');
        
        // First check if we can communicate with the content script
        chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, { action: 'ping' })
            .then(response => {
                console.log('Token Inspector DevTools: Ping response:', response);
                if (response && response.success) {
                    // Content script is responsive, proceed with scan
                    return chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, { action: 'runScan' });
                } else {
                    throw new Error('Content script not responsive');
                }
            })
            .then(response => {
                console.log('Token Inspector DevTools: Scan message sent, response:', response);
                if (response && response.success && response.results) {
                    // Results received immediately
                    scanInProgress = false;
                    scanButton.disabled = false;
                    scannerState.style.display = 'none';
                    displayResults(response.results);
                } else {
                    // Wait for async results via message listener
                    console.log('Token Inspector DevTools: Waiting for async scan results...');
                }
            })
            .catch(err => {
                console.error('Token Inspector DevTools: Error sending scan message:', err);
                
                // Show user-friendly error message
                scannerState.innerHTML = `
                    <div class="scanner-content">
                        <div style="color: #ff6b6b; margin-bottom: 10px;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                        </div>
                        <p>Cannot communicate with page</p>
                        <p style="font-size: 11px; color: #999; margin-top: 5px;">
                            The content script is not available on this page.
                            Try refreshing the page or opening a different website.
                        </p>
                    </div>
                `;
                
                scanInProgress = false;
                scanButton.disabled = false;
            });
    }

    // Display results with tab functionality (same as popup)
    function displayResults(results) {
        resultsContainer.innerHTML = '';

        // Handle both array format (old) and object format (new)
        if (Array.isArray(results)) {
            // Convert array format to object format
            const converted = {};
            results.forEach(item => {
                let category = 'Other Properties';
                if (item.category === 'Colors' || item.property.includes('Color')) {
                    category = 'Colors';
                } else if (item.category === 'Typography' || item.property.includes('Font') || item.property.includes('Line')) {
                    category = 'Typography';
                } else if (item.category === 'Spacing' || item.property.includes('Margin') || item.property.includes('Padding')) {
                    category = 'Spacing';
                } else if (item.category === 'Radius' || item.property.includes('Radius')) {
                    category = 'Radius';
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

    function updateTabCounts() {
        const totalIssues = Object.values(allResults).reduce((sum, items) => sum + items.length, 0);
        
        // Update all count
        const allCount = document.getElementById('all-count');
        if (allCount) allCount.textContent = totalIssues;
        
        // Update individual category counts
        const categories = ['Colors', 'Typography', 'Spacing', 'Radius'];
        categories.forEach(category => {
            const countElement = document.getElementById(category.toLowerCase() + '-count');
            if (countElement) {
                const count = allResults[category] ? allResults[category].length : 0;
                countElement.textContent = count;
            }
        });
    }

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

    function displayCurrentCategory() {
        resultsContainer.innerHTML = '';

        if (currentCategory === 'all') {
            // Display all categories
            Object.keys(allResults).forEach(category => {
                const items = allResults[category];
                if (items.length > 0) {
                    const section = createCategorySection(category, items);
                    resultsContainer.appendChild(section);
                }
            });
        } else {
            // Display specific category
            const items = allResults[currentCategory] || [];
            if (items.length > 0) {
                const section = createCategorySection(currentCategory, items);
                resultsContainer.appendChild(section);
            }
        }
    }

    function createCategorySection(category, items) {
        const section = document.createElement('div');
        section.className = 'category-section';

        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `<span class="category-title">${category}</span><span class="category-count">${items.length}</span>`;

        const list = document.createElement('div');
        list.className = 'results-list';

        items.forEach(itemData => {
            const card = createIssueCard(itemData);
            list.appendChild(card);
        });

        section.appendChild(header);
        section.appendChild(list);
        return section;
    }

    function createIssueCard(itemData) {
        const card = document.createElement('div');
        card.className = 'issue-card';
        card.dataset.elementId = itemData.elementId;

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

        card.addEventListener('click', () => {
            console.log('Token Inspector DevTools: Clicked on item with data:', itemData);
            
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
                            console.log('Token Inspector DevTools: Invalid selector:', itemData.selector);
                        }
                    }
                    
                    // If still not found, try to find by path
                    if (!element && itemData.path) {
                        const pathParts = itemData.path.split(' > ');
                        if (pathParts.length > 0) {
                            try {
                                element = document.querySelector(pathParts[pathParts.length - 1]);
                            } catch (e) {
                                console.log('Token Inspector DevTools: Invalid path selector:', pathParts[pathParts.length - 1]);
                            }
                        }
                    }
                    
                    if (element) {
                        console.log('Token Inspector DevTools: Found element for highlighting:', element);
                        
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
                        
                        // Add highlight
                        element.style.outline = '4px solid #FF3B30';
                        element.style.boxShadow = '0 0 25px rgba(255, 59, 48, 0.8)';
                        element.style.backgroundColor = 'rgba(255, 59, 48, 0.15)';
                        element.style.zIndex = '9999';
                        element.style.position = 'relative';
                        element.classList.add('ds-lint-highlight');
                        
                        // Scroll to element
                        element.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center',
                            inline: 'center'
                        });
                        
                        // Remove highlight after 3 seconds
                        setTimeout(() => {
                            if (element.classList.contains('ds-lint-highlight')) {
                                element.style.outline = '';
                                element.style.boxShadow = '';
                                element.style.backgroundColor = '';
                                element.style.zIndex = '';
                                element.style.position = '';
                                element.classList.remove('ds-lint-highlight');
                            }
                        }, 3000);
                    } else {
                        console.log('Token Inspector DevTools: Could not find element for highlighting. ElementId:', '${itemData.elementId}', 'Selector:', '${itemData.selector}');
                    }
                })()
            `);
        });
        return card;
    }

    function formatCssValue(value) {
        // Return the original value as-is to preserve the CSS format
        // This ensures hex values stay hex, rgb values stay rgb, etc.
        return value;
    }

    // Add click handler for scan button
    scanButton.addEventListener('click', () => {
        performDevToolsScan();
    });

    // Start scanning automatically when panel loads with better timing
    console.log('Token Inspector DevTools: Panel loaded, starting automatic scan...');
    
    // Wait for panel to be fully ready, then start scan
    setTimeout(() => {
        console.log('Token Inspector DevTools: Starting automatic scan...');
        performDevToolsScan();
    }, 2000); // Increased delay to ensure everything is ready
}); 