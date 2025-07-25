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
        } else if (request.type === 'contentScriptReady') {
            console.log('Token Inspector Popup: Content script is ready');
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
        
        console.log('Token Inspector: Showing category tabs and results');
        
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
        const summaryItems = categoryTabs.querySelectorAll('.summary-item');
        console.log('Token Inspector: Found', summaryItems.length, 'summary items');
        
        summaryItems.forEach(item => {
            console.log('Token Inspector: Setting up click handler for', item.dataset.category);
            item.addEventListener('click', () => {
                console.log('Token Inspector: Clicked on category:', item.dataset.category);
                // Update active tab
                summaryItems.forEach(summaryItem => summaryItem.classList.remove('summary-item-highlighted'));
                item.classList.add('summary-item-highlighted');
                
                // Update current category and display
                currentCategory = item.dataset.category;
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
        section.className = 'section';

        const header = document.createElement('div');
        header.className = 'section-header';
        header.innerHTML = `<div class="section-title">${category}</div><div class="section-count">${items.length}</div>`;

        section.appendChild(header);

        items.forEach(itemData => {
            const item = createIssueItem(itemData);
            section.appendChild(item);
        });

        return section;
    }

    function createIssueItem(itemData) {
        const item = document.createElement('div');
        item.className = 'item';
        item.dataset.elementId = itemData.elementId;

        // Determine icon type and value class based on category
        const iconType = getIconType(itemData);
        const valueClass = getValueClass(itemData);

        // Format the value to show the original format (hex vs rgba)
        const formattedValue = formatCssValue(itemData.value);

        item.innerHTML = `
            <div class="icon-container ${iconType}">
                ${getIconSvg(iconType)}
            </div>
            <div class="item-content">
                <div class="item-title">${itemData.selector}</div>
                <div class="item-details">
                    <div class="item-detail">
                        <span class="detail-label">${itemData.property}:</span>
                        <span class="detail-value ${valueClass}">${formattedValue}</span>
                    </div>
                    <div class="item-element">${itemData.path}</div>
                </div>
            </div>
        `;

        item.addEventListener('click', () => {
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
                                
                                // Remove highlight after 3 seconds
                                setTimeout(() => {
                                    if (element.classList.contains('ds-lint-highlight')) {
                                        element.style.outline = '';
                                        element.style.boxShadow = '';
                                        element.style.animation = '';
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
                                elementId: item.dataset.elementId,
                                issueData: itemData
                            });
                        }, 50);
                    });
                }
            });
        });
        return item;
    }

    function getIconType(itemData) {
        if (itemData.category === 'Colors' || itemData.property.includes('Color')) {
            return 'icon-color';
        } else if (itemData.category === 'Typography' || itemData.property.includes('Font') || itemData.property.includes('Line')) {
            return 'icon-font';
        } else if (itemData.category === 'Spacing' || itemData.property.includes('Margin') || itemData.property.includes('Padding')) {
            return 'icon-spacing';
        } else if (itemData.category === 'Radius' || itemData.property.includes('Radius')) {
            return 'icon-radius';
        }
        return 'icon-color'; // Default
    }

    function getValueClass(itemData) {
        if (itemData.category === 'Colors' || itemData.property.includes('Color')) {
            return 'color-value';
        } else if (itemData.category === 'Typography' || itemData.property.includes('Font') || itemData.property.includes('Line')) {
            return 'font-value';
        } else if (itemData.category === 'Spacing' || itemData.property.includes('Margin') || itemData.property.includes('Padding')) {
            return 'spacing-value';
        } else if (itemData.category === 'Radius' || itemData.property.includes('Radius')) {
            return 'radius-value';
        }
        return 'color-value'; // Default
    }

    function getIconSvg(iconType) {
        const icons = {
            'icon-color': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 3C12.6581 2.99977 13.3062 3.16193 13.8866 3.4721C14.4671 3.78228 14.962 4.23088 15.3276 4.77815C15.6932 5.32541 15.918 5.95442 15.9823 6.60941C16.0466 7.2644 15.9482 7.92512 15.696 8.533C14.8622 8.6216 14.0562 8.88397 13.3301 9.30321C12.6039 9.72244 11.9737 10.2892 11.48 10.967C10.5173 10.8408 9.63334 10.3687 8.99303 9.63877C8.35272 8.90886 7.99977 7.97096 8 7C8 5.93913 8.42143 4.92172 9.17157 4.17157C9.92172 3.42143 10.9391 3 12 3ZM17.764 8.672C18.0226 7.77826 18.0699 6.83662 17.902 5.92148C17.7342 5.00634 17.3558 4.14278 16.7967 3.39903C16.2377 2.65529 15.5134 2.05174 14.681 1.63608C13.8486 1.22042 12.9309 1.00405 12.0005 1.00405C11.0701 1.00405 10.1524 1.22042 9.32002 1.63608C8.48762 2.05174 7.76329 2.65529 7.20427 3.39903C6.64524 4.14278 6.26684 5.00634 6.09897 5.92148C5.9311 6.83662 5.97835 7.77826 6.237 8.672C5.33367 8.89483 4.49454 9.32469 3.78592 9.92761C3.0773 10.5305 2.5186 11.29 2.15397 12.146C1.78934 13.0019 1.62878 13.931 1.68496 14.8597C1.74115 15.7884 2.01255 16.6913 2.47771 17.4971C2.94287 18.3029 3.58905 18.9894 4.36519 19.5025C5.14133 20.0156 6.02616 20.3412 6.94976 20.4535C7.87336 20.5658 8.81043 20.4618 9.68692 20.1497C10.5634 19.8375 11.3553 19.3258 12 18.655C12.6447 19.3257 13.4366 19.8373 14.313 20.1494C15.1894 20.4615 16.1264 20.5655 17.0499 20.4532C17.9735 20.3409 18.8582 20.0154 19.6343 19.5023C20.4104 18.9893 21.0566 18.3029 21.5218 17.4972C21.9869 16.6915 22.2584 15.7887 22.3147 14.8601C22.371 13.9314 22.2105 13.0024 21.8461 12.1465C21.4816 11.2905 20.9231 10.531 20.2146 9.92802C19.5062 9.32502 18.6672 8.89502 17.764 8.672ZM13.154 16.934C13.494 16.1678 13.6697 15.3388 13.6697 14.5005C13.6697 13.6622 13.494 12.8332 13.154 12.067C13.6626 11.4032 14.3664 10.9155 15.1665 10.6724C15.9666 10.4292 16.8227 10.4429 17.6147 10.7114C18.4066 10.9799 19.0945 11.4898 19.5817 12.1695C20.0689 12.8491 20.3309 13.6643 20.3309 14.5005C20.3309 15.3367 20.0689 16.1519 19.5817 16.8315C19.0945 17.5112 18.4066 18.0211 17.6147 18.2896C16.8227 18.5581 15.9666 18.5718 15.1665 18.3286C14.3664 18.0855 13.6626 17.5978 13.154 16.934ZM11.364 12.967C11.6845 13.7394 11.7549 14.5928 11.5653 15.4073C11.3757 16.2218 10.9357 16.9564 10.3071 17.5079C9.67847 18.0594 8.89286 18.4 8.06064 18.482C7.22842 18.564 6.39144 18.3831 5.6673 17.9649C4.94317 17.5466 4.3683 16.912 4.02346 16.1501C3.67862 15.3883 3.58116 14.5376 3.74477 13.7175C3.90838 12.8974 4.32484 12.1492 4.93562 11.578C5.5464 11.0068 6.32081 10.6414 7.15 10.533C7.64354 11.2107 8.27362 11.7774 8.9996 12.1966C9.72559 12.6158 10.5304 12.8783 11.364 12.967Z" fill="#BC2FB0"/>
            </svg>`,
            'icon-font': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M10 6V21H8V6H2V4H16V6H10ZM18 14V21H16V14H13V12H21V14H18Z" fill="#C39004"/>
            </svg>`,
            'icon-spacing': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M6.343 14.728L3.515 17.557L7.05 21.092L20.485 7.657L16.95 4.121L14.829 6.243L16.243 7.657L14.829 9.071L13.414 7.657L11.293 9.778L13.414 11.9L12 13.314L9.88 11.193L7.758 13.313L9.173 14.728L7.758 16.142L6.343 14.728ZM17.657 2L22.607 6.95C22.7945 7.13753 22.8998 7.39183 22.8998 7.657C22.8998 7.92216 22.7945 8.17647 22.607 8.364L7.757 23.214C7.56947 23.4015 7.31517 23.5068 7.05 23.5068C6.78484 23.5068 6.53053 23.4015 6.343 23.214L1.393 18.264C1.30002 18.1711 1.22627 18.0608 1.17594 17.9394C1.12562 17.818 1.09971 17.6879 1.09971 17.5565C1.09971 17.4251 1.12562 17.295 1.17594 17.1736C1.22627 17.0522 1.30002 16.9419 1.393 16.849L16.243 2C16.4305 1.81253 16.6848 1.70721 16.95 1.70721C17.2152 1.70721 17.4695 1.81253 17.657 2Z" fill="#8D62F1"/>
            </svg>`,
            'icon-radius': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M21 19V21H19V19H21ZM17 19V21H15V19H17ZM13 19V21H11V19H13ZM9 19V21H7V19H9ZM5 19V21H3V19H5ZM21 15V17H19V15H21ZM5 15V17H3V15H5ZM5 11V13H3V11H5ZM16 3C17.2885 3.00007 18.5272 3.49754 19.4578 4.38866C20.3884 5.27978 20.9391 6.49575 20.995 7.783L21 8V13H19V8C18.9977 7.23549 18.7045 6.50053 18.18 5.94429C17.6555 5.38806 16.939 5.05224 16.176 5.005L16 5H11V3H16ZM5 7V9H3V7H5ZM5 3V5H3V3H5ZM9 3V5H7V3H9Z" fill="#2D8395"/>
            </svg>`
        };
        return icons[iconType] || icons['icon-color'];
    }

    function formatCssValue(value) {
        // Return the original value as-is to preserve the CSS format
        // This ensures hex values stay hex, rgb values stay rgb, etc.
        return value;
    }

    // Start scanning automatically when popup opens
    scanner.startScan();
});