document.addEventListener('DOMContentLoaded', function() {
    const scannerState = document.getElementById('scanner-state');
    const resultsContainer = document.getElementById('results-container');
    const noResultsMessage = document.getElementById('no-results-message');
    const categoryTabs = document.getElementById('category-tabs');
    let allResults = {};
    let currentCategory = 'all';

    function startScan() {
        scannerState.style.display = 'flex';
        resultsContainer.style.display = 'none';
        noResultsMessage.style.display = 'none';
        categoryTabs.style.display = 'none';

        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs.length === 0) return;
            
            // Use DevTools API if available, otherwise fall back to content script
            if (chrome.devtools && chrome.devtools.inspectedWindow) {
                scanWithDevTools();
            } else {
                scanWithContentScript(tabs[0].id);
            }
        });
    }

    function scanWithDevTools() {
        chrome.devtools.inspectedWindow.eval(`
            (function() {
                // Get all stylesheets
                const stylesheets = Array.from(document.styleSheets);
                const results = {
                    'Colors': [],
                    'Spacing': [],
                    'Typography': [],
                    'Radius': []
                };
                let elementCounter = 0;

                function getCssSelector(el) {
                    if (el.id) return '#' + el.id;
                    if (el.className) {
                        // Handle both string and DOMTokenList
                        let classNames;
                        if (typeof el.className === 'string') {
                            classNames = el.className.split(' ').filter(c => c.trim());
                        } else if (el.className && el.className.length) {
                            // DOMTokenList
                            classNames = Array.from(el.className).filter(c => c.trim());
                        }
                        
                        if (classNames && classNames.length > 0) {
                            return el.tagName.toLowerCase() + '.' + classNames.join('.');
                        }
                    }
                    return el.tagName.toLowerCase();
                }

                function getBreadcrumbs(el) {
                    const breadcrumbs = [];
                    let current = el;
                    while (current && current !== document.body) {
                        breadcrumbs.unshift(getCssSelector(current));
                        current = current.parentElement;
                    }
                    return breadcrumbs.join(' > ');
                }

                // Check each stylesheet
                stylesheets.forEach((sheet, sheetIndex) => {
                    try {
                        const rules = Array.from(sheet.cssRules || sheet.rules || []);
                        
                        rules.forEach((rule, ruleIndex) => {
                            if (rule.style) {
                                const style = rule.style;
                                const propertiesToCheck = {
                                    'color': { name: 'Text Color', category: 'Colors' },
                                    'background-color': { name: 'Background Color', category: 'Colors' },
                                    'border-color': { name: 'Border Color', category: 'Colors' },
                                    'border-top-color': { name: 'Border Top Color', category: 'Colors' },
                                    'border-right-color': { name: 'Border Right Color', category: 'Colors' },
                                    'border-bottom-color': { name: 'Border Bottom Color', category: 'Colors' },
                                    'border-left-color': { name: 'Border Left Color', category: 'Colors' },
                                    'font-size': { name: 'Font Size', category: 'Typography' },
                                    'font-weight': { name: 'Font Weight', category: 'Typography' },
                                    'line-height': { name: 'Line Height', category: 'Typography' },
                                    'margin': { name: 'Margin', category: 'Spacing' },
                                    'padding': { name: 'Padding', category: 'Spacing' },
                                    'border-radius': { name: 'Border Radius', category: 'Radius' },
                                    'border-top-left-radius': { name: 'Border Top Left Radius', category: 'Radius' },
                                    'border-top-right-radius': { name: 'Border Top Right Radius', category: 'Radius' },
                                    'border-bottom-left-radius': { name: 'Border Bottom Left Radius', category: 'Radius' },
                                    'border-bottom-right-radius': { name: 'Border Bottom Right Radius', category: 'Radius' }
                                };
                                
                                Object.keys(propertiesToCheck).forEach(property => {
                                    const value = style.getPropertyValue(property);
                                    if (value && value.trim() && 
                                        !value.startsWith('var(--') && 
                                        !value.startsWith('inherit') && 
                                        !value.startsWith('initial') &&
                                        value !== 'transparent' && 
                                        value !== 'currentColor') {
                                        
                                        // Try to get the original value format for colors
                                        let originalValue = value;
                                        if (property.includes('color')) {
                                            try {
                                                // Check if we can get the original declaration
                                                const cssText = style.cssText;
                                                // Use a simpler approach to find the property value
                                                const propertyIndex = cssText.toLowerCase().indexOf(property.toLowerCase());
                                                if (propertyIndex !== -1) {
                                                    const afterProperty = cssText.substring(propertyIndex + property.length);
                                                    const colonIndex = afterProperty.indexOf(':');
                                                    if (colonIndex !== -1) {
                                                        const afterColon = afterProperty.substring(colonIndex + 1);
                                                        const semicolonIndex = afterColon.indexOf(';');
                                                        const extractedValue = semicolonIndex !== -1 
                                                            ? afterColon.substring(0, semicolonIndex).trim()
                                                            : afterColon.trim();
                                                        // If the extracted value is in hex format, use it
                                                        if (extractedValue.match(/^#[0-9a-fA-F]{3,6}$/)) {
                                                            originalValue = extractedValue;
                                                        }
                                                    }
                                                }
                                            } catch (e) {
                                                // Fall back to the computed value
                                            }
                                        }
                                        
                                        const propertyInfo = propertiesToCheck[property];
                                        let shouldFlag = false;
                                        
                                        // Check for hardcoded colors
                                        if (property.includes('color') && (
                                            value.match(/^#[0-9a-fA-F]{3,6}$/) ||
                                            value.match(/^rgb\\([^)]+\\)$/) ||
                                            value.match(/^rgba\\([^)]+\\)$/) ||
                                            value.match(/^hsl\\([^)]+\\)$/) ||
                                            value.match(/^hsla\\([^)]+\\)$/)
                                        )) {
                                            // Skip common default colors and transparent values
                                            if (value !== 'rgba(0, 0, 0, 0)' &&
                                                value !== 'rgb(0, 0, 0)' &&
                                                value !== 'rgb(255, 255, 255)' &&
                                                value !== 'rgba(255, 255, 255, 1)' &&
                                                value !== '#000000' &&
                                                value !== '#ffffff' &&
                                                value !== '#000' &&
                                                value !== '#fff') {
                                                shouldFlag = true;
                                            }
                                        }
                                        // Check for hardcoded spacing values
                                        else if (property.includes('margin') || property.includes('padding')) {
                                            if (value.match(/^\\d+px$/) || value.match(/^\\d+\\.\\d+px$/)) {
                                                shouldFlag = true;
                                            }
                                        }
                                        // Check for hardcoded typography values
                                        else if (property.includes('font-size') || property.includes('font-weight') || property.includes('line-height')) {
                                            if (value.match(/^\\d+px$/) || value.match(/^\\d+\\.\\d+px$/) || value.match(/^\\d+$/)) {
                                                shouldFlag = true;
                                            }
                                        }
                                        // Check for hardcoded border radius values
                                        else if (property.includes('border-radius')) {
                                            if (value.match(/^\\d+px$/) || value.match(/^\\d+\\.\\d+px$/)) {
                                                shouldFlag = true;
                                            }
                                        }
                                        
                                        if (shouldFlag) {
                                            // Find elements that match this rule
                                            try {
                                                const elements = document.querySelectorAll(rule.selectorText);
                                                elements.forEach(element => {
                                                    const elementId = 'ds-lint-' + (++elementCounter);
                                                    element.setAttribute('data-ds-lint-id', elementId);
                                                    
                                                    results[propertyInfo.category].push({
                                                        elementId: elementId,
                                                        selector: getCssSelector(element),
                                                        property: propertyInfo.name,
                                                        value: originalValue,
                                                        path: getBreadcrumbs(element),
                                                        rule: rule.selectorText,
                                                        stylesheet: sheet.href || 'inline'
                                                    });
                                                    
                                                    // Debug: Log the element that was marked
                                                    console.log('DS-Lint DevTools: Marked element', elementId, 'with value', value, 'for property', property);
                                                });
                                            } catch (e) {
                                                // Invalid selector, skip
                                                console.log('DS-Lint DevTools: Invalid selector:', rule.selectorText, e);
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    } catch (e) {
                        // Cross-origin stylesheet, skip
                    }
                });

                return results;
            })()
        `, function(result, isException) {
            scannerState.style.display = 'none';
            
            if (isException) {
                console.error('DS-Lint: Error scanning page:', isException);
                return;
            }

            displayResults(result || []);
        });
    }

    function scanWithContentScript(tabId) {
        chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] }, () => {
            // Wait a bit for the script to initialize
            setTimeout(() => {
                chrome.tabs.sendMessage(tabId, { action: 'runScan' });
            }, 100);
        });
    }

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'scanComplete') {
            scannerState.style.display = 'none';
            displayResults(request.results);
        }
    });

    function displayResults(results) {
        resultsContainer.innerHTML = '';

        // Handle both array format (old DevTools) and object format (new)
        if (Array.isArray(results)) {
            // Results from old DevTools API - convert to new format
            if (results.length === 0) {
                noResultsMessage.style.display = 'flex';
                return;
            }

            // Convert to new category format
            allResults = {};
            results.forEach(item => {
                const category = item.property.includes('Color') ? 'Colors' : 'Other Properties';
                if (!allResults[category]) {
                    allResults[category] = [];
                }
                allResults[category].push(item);
            });
        } else {
            // Results from content script or new DevTools format
            allResults = results;
        }

        // Check if we have any results
        const totalIssues = Object.values(allResults).reduce((sum, items) => sum + items.length, 0);
        if (totalIssues === 0) {
            noResultsMessage.style.display = 'flex';
            return;
        }

        // Show category tabs and display results
        categoryTabs.style.display = 'flex';
        resultsContainer.style.display = 'block';
        
        // Setup tab functionality
        setupCategoryTabs();
        
        // Display current category
        displayCurrentCategory();
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
        
        // Open the first category by default
        const firstHeader = resultsContainer.querySelector('.category-header');
        if (firstHeader) firstHeader.click();
    }

    function formatCssValue(value) {
        // If it's already in hex format, return as is
        if (value.match(/^#[0-9a-fA-F]{3,6}$/)) {
            return value;
        }
        
        // If it's rgba, try to convert to hex if possible
        if (value.match(/^rgba?\([^)]+\)$/)) {
            try {
                // Create a temporary element to convert rgba to hex
                const tempDiv = document.createElement('div');
                tempDiv.style.color = value;
                document.body.appendChild(tempDiv);
                
                // Get the computed style which might be in hex
                const computedColor = window.getComputedStyle(tempDiv).color;
                document.body.removeChild(tempDiv);
                
                // If the computed color is different from the original, use it
                if (computedColor !== value) {
                    return computedColor;
                }
                
                // If it's still rgba, try to convert manually for common cases
                const rgbaMatch = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
                if (rgbaMatch) {
                    const r = parseInt(rgbaMatch[1]);
                    const g = parseInt(rgbaMatch[2]);
                    const b = parseInt(rgbaMatch[3]);
                    const a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
                    
                    // Convert to hex
                    const toHex = (n) => {
                        const hex = n.toString(16);
                        return hex.length === 1 ? '0' + hex : hex;
                    };
                    
                    const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                    
                    // If alpha is 1, return hex, otherwise return rgba
                    if (a === 1) {
                        return hexColor;
                    } else {
                        return value; // Keep rgba for transparency
                    }
                }
            } catch (e) {
                console.log('DS-Lint: Error converting color format:', e);
            }
            
            return value;
        }
        
        // Handle other color formats
        if (value.match(/^hsl\([^)]+\)$/) || value.match(/^hsla\([^)]+\)$/)) {
            try {
                // Create a temporary element to convert hsl to hex
                const tempDiv = document.createElement('div');
                tempDiv.style.color = value;
                document.body.appendChild(tempDiv);
                
                const computedColor = window.getComputedStyle(tempDiv).color;
                document.body.removeChild(tempDiv);
                
                if (computedColor !== value) {
                    return computedColor;
                }
            } catch (e) {
                console.log('DS-Lint: Error converting HSL color format:', e);
            }
        }
        
        // For other values, return as is
        return value;
    }

    function createCategorySection(category, items) {
        const section = document.createElement('div');
        section.className = 'category-section';

        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `<span class="category-title">${category}</span><span class="category-count">${items.length}</span>`;

        const list = document.createElement('ul');
        list.className = 'results-list';

        items.forEach(itemData => {
            const card = createIssueCard(itemData);
            list.appendChild(card);
        });

        header.addEventListener('click', () => {
            const isHidden = list.style.display === 'none' || list.style.display === '';
            list.style.display = isHidden ? 'block' : 'none';
        });

        section.appendChild(header);
        section.appendChild(list);
        return section;
    }

    function createIssueCard(itemData) {
        const li = document.createElement('li');
        li.className = 'result-item-card';
        li.dataset.elementId = itemData.elementId;

        // Format the value to show the original format (hex vs rgba)
        const formattedValue = formatCssValue(itemData.value);

        li.innerHTML = `
            <div class="item-selector" title="${itemData.selector}">${itemData.selector}</div>
            <div class="item-details">
                <span class="item-property">${itemData.property}:</span>
                <span class="item-value">${formattedValue}</span>
            </div>
            <div class="item-path" title="${itemData.path}">${itemData.path}</div>
        `;

        li.addEventListener('click', () => {
            console.log('DS-Lint: Clicked on item with data:', itemData);
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
                                    console.log('DS-Lint: Invalid selector:', itemData.selector);
                                }
                            }
                            
                            // If still not found, try to find by path
                            if (!element && itemData.path) {
                                const pathParts = itemData.path.split(' > ');
                                if (pathParts.length > 0) {
                                    try {
                                        element = document.querySelector(pathParts[pathParts.length - 1]);
                                    } catch (e) {
                                        console.log('DS-Lint: Invalid path selector:', pathParts[pathParts.length - 1]);
                                    }
                                }
                            }
                            
                            if (element) {
                                console.log('DS-Lint: Found element for highlighting:', element);
                                
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
                                console.log('DS-Lint: Could not find element for highlighting. ElementId:', '${itemData.elementId}', 'Selector:', '${itemData.selector}');
                            }
                        })()
                    `);
                } else {
                    // Fall back to content script
                    chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, files: ['content.js'] }, () => {
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabs[0].id, { 
                                action: 'inspectElement', 
                                elementId: li.dataset.elementId 
                            });
                        }, 50);
                    });
                }
            });
        });
        return li;
    }

    startScan();
});