document.addEventListener('DOMContentLoaded', function() {
    const scannerState = document.getElementById('scanner-state');
    const resultsContainer = document.getElementById('results-container');
    const noResultsMessage = document.getElementById('no-results-message');
    const categoryTabs = document.getElementById('category-tabs');
    let allResults = {};
    let currentCategory = 'all';

    // Initialize the shared scanner for popup
    const scanner = new TokenInspectorScanner({
        isDevTools: false,
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
            console.error('Token Inspector Popup: Error:', error);
            scannerState.style.display = 'none';
        }
    });

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'scanComplete') {
            scanner.onScanComplete();
            displayResults(request.results);
        }
    });

    // Display results with tab functionality (popup-specific)
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
            <div class="issue-selector" title="${itemData.selector}">${itemData.selector}</div>
            <div class="issue-details">
                <span class="issue-property">${itemData.property}:</span>
                <span class="issue-value">${formattedValue}</span>
            </div>
            <div class="issue-path" title="${itemData.path}">${itemData.path}</div>
        `;

        card.addEventListener('click', () => {
            console.log('Token Inspector: Clicked on item with data:', itemData);
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
                                    console.log('Token Inspector: Invalid selector:', itemData.selector);
                                }
                            }
                            
                            // If still not found, try to find by path
                            if (!element && itemData.path) {
                                const pathParts = itemData.path.split(' > ');
                                if (pathParts.length > 0) {
                                    try {
                                        element = document.querySelector(pathParts[pathParts.length - 1]);
                                    } catch (e) {
                                        console.log('Token Inspector: Invalid path selector:', pathParts[pathParts.length - 1]);
                                    }
                                }
                            }
                            
                            if (element) {
                                console.log('Token Inspector: Found element for highlighting:', element);
                                
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
                                console.log('Token Inspector: Could not find element for highlighting. ElementId:', '${itemData.elementId}', 'Selector:', '${itemData.selector}');
                            }
                        })()
                    `);
                } else {
                    // Fall back to content script
                    chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, files: ['content.js'] }, () => {
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabs[0].id, { 
                                action: 'inspectElement', 
                                elementId: card.dataset.elementId 
                            });
                        }, 50);
                    });
                }
            });
        });
        return card;
    }

    function formatCssValue(value) {
        // Return the original value as-is to preserve the CSS format
        // This ensures hex values stay hex, rgb values stay rgb, etc.
        return value;
    }

    // Start scanning automatically when popup opens
    scanner.startScan();
});