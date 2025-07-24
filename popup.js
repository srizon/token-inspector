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
        chrome.devtools.inspectedWindow.eval(
            "(function() {" +
            "    const stylesheets = Array.from(document.styleSheets);" +
            "    const results = {" +
            "        'Colors': []," +
            "        'Spacing': []," +
            "        'Typography': []," +
            "        'Radius': []" +
            "    };" +
            "    let elementCounter = 0;" +
            "    const selectorCache = new Map();" +
            "    const breadcrumbCache = new Map();" +
            "" +
            "    function getCssSelector(el) {" +
            "        const cacheKey = el.tagName + (el.id || '') + (el.className || '');" +
            "        if (selectorCache.has(cacheKey)) {" +
            "            return selectorCache.get(cacheKey);" +
            "        }" +
            "        " +
            "        let selector;" +
            "        if (el.id) {" +
            "            selector = '#' + el.id;" +
            "        } else if (el.className) {" +
            "            let classNames;" +
            "            if (typeof el.className === 'string') {" +
            "                classNames = el.className.split(' ').filter(c => c.trim());" +
            "            } else if (el.className && el.className.length) {" +
            "                classNames = Array.from(el.className).filter(c => c.trim());" +
            "            }" +
            "            if (classNames && classNames.length > 0) {" +
            "                selector = el.tagName.toLowerCase() + '.' + classNames.join('.');" +
            "            } else {" +
            "                selector = el.tagName.toLowerCase();" +
            "            }" +
            "        } else {" +
            "            selector = el.tagName.toLowerCase();" +
            "        }" +
            "        " +
            "        selectorCache.set(cacheKey, selector);" +
            "        return selector;" +
            "    }" +
            "" +
            "    function getBreadcrumbs(el) {" +
            "        if (breadcrumbCache.has(el)) {" +
            "            return breadcrumbCache.get(el);" +
            "        }" +
            "        " +
            "        const breadcrumbs = [];" +
            "        let current = el;" +
            "        let depth = 0;" +
            "        const maxDepth = 10;" +
            "        " +
            "        while (current && current !== document.body && depth < maxDepth) {" +
            "            breadcrumbs.unshift(getCssSelector(current));" +
            "            current = current.parentElement;" +
            "            depth++;" +
            "        }" +
            "        " +
            "        const result = breadcrumbs.join(' > ');" +
            "        breadcrumbCache.set(el, result);" +
            "        return result;" +
            "    }" +
            "" +
            "    // Pre-compute element-rule mapping for better performance" +
            "    const elementRuleMap = new Map();" +
            "    const allElements = document.querySelectorAll('*');" +
            "    " +
            "    stylesheets.forEach((sheet, sheetIndex) => {" +
            "        try {" +
            "            const rules = Array.from(sheet.cssRules || sheet.rules || []);" +
            "            rules.forEach((rule, ruleIndex) => {" +
            "                if (rule.style) {" +
            "                    try {" +
            "                        const matchingElements = document.querySelectorAll(rule.selectorText);" +
            "                        matchingElements.forEach(element => {" +
            "                            if (!elementRuleMap.has(element)) {" +
            "                                elementRuleMap.set(element, []);" +
            "                            }" +
            "                            elementRuleMap.get(element).push({" +
            "                                rule: rule," +
            "                                style: rule.style," +
            "                                selector: rule.selectorText," +
            "                                sheetIndex: sheetIndex," +
            "                                ruleIndex: ruleIndex" +
            "                            });" +
            "                        });" +
            "                    } catch (e) {" +
            "                        // Invalid selector, skip" +
            "                    }" +
            "                }" +
            "            });" +
            "        } catch (e) {" +
            "            // Cross-origin stylesheet, skip" +
            "        }" +
            "    });" +
            "" +
            "    // Process elements with their pre-matched rules" +
            "    elementRuleMap.forEach((elementRules, element) => {" +
            "        if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE' || " +
            "            element.tagName === 'NOSCRIPT' || element.tagName === 'META') {" +
            "            return;" +
            "        }" +
            "        " +
            "        elementRules.forEach(ruleData => {" +
            "            const style = ruleData.style;" +
            "            const propertiesToCheck = {" +
            "                'color': { name: 'color', category: 'Colors' }," +
            "                'background-color': { name: 'background-color', category: 'Colors' }," +
            "                'border-color': { name: 'border-color', category: 'Colors' }," +
            "                'border-top-color': { name: 'border-top-color', category: 'Colors' }," +
            "                'border-right-color': { name: 'border-right-color', category: 'Colors' }," +
            "                'border-bottom-color': { name: 'border-bottom-color', category: 'Colors' }," +
            "                'border-left-color': { name: 'border-left-color', category: 'Colors' }," +
            "                'font-size': { name: 'font-size', category: 'Typography' }," +
            "                'font-weight': { name: 'font-weight', category: 'Typography' }," +
            "                'line-height': { name: 'line-height', category: 'Typography' }," +
            "                'margin': { name: 'margin', category: 'Spacing' }," +
            "                'padding': { name: 'padding', category: 'Spacing' }," +
            "                'border-radius': { name: 'border-radius', category: 'Radius' }," +
            "                'border-top-left-radius': { name: 'border-top-left-radius', category: 'Radius' }," +
            "                'border-top-right-radius': { name: 'border-top-right-radius', category: 'Radius' }," +
            "                'border-bottom-left-radius': { name: 'border-bottom-left-radius', category: 'Radius' }," +
            "                'border-bottom-right-radius': { name: 'border-bottom-right-radius', category: 'Radius' }" +
            "            };" +
            "" +
            "            Object.keys(propertiesToCheck).forEach(property => {" +
            "                const value = style.getPropertyValue(property);" +
            "                if (value && value.trim() && " +
            "                    !value.startsWith('var(--') && " +
            "                    !value.startsWith('inherit') && " +
            "                    !value.startsWith('initial') &&" +
            "                    value !== 'transparent' && " +
            "                    value !== 'currentColor') {" +
            "" +
            "                    let originalValue = value;" +
            "                    if (property.includes('color')) {" +
            "                        if (value.match(/^rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)$/)) {" +
            "                            const rgbMatch = value.match(/^rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)$/);" +
            "                            const r = parseInt(rgbMatch[1]);" +
            "                            const g = parseInt(rgbMatch[2]);" +
            "                            const b = parseInt(rgbMatch[3]);" +
            "                            const toHex = (n) => {" +
            "                                const hex = n.toString(16);" +
            "                                return hex.length === 1 ? '0' + hex : hex;" +
            "                            };" +
            "                            const hexColor = '#' + toHex(r) + toHex(g) + toHex(b);" +
            "                            originalValue = hexColor;" +
            "                        } else if (value.match(/^rgba\\([^)]+\\)$/)) {" +
            "                            originalValue = value;" +
            "                        } else {" +
            "                            originalValue = value;" +
            "                        }" +
            "                    }" +
            "" +
            "                    const propertyInfo = propertiesToCheck[property];" +
            "                    let shouldFlag = false;" +
            "" +
            "                    if (property.includes('color') && (" +
            "                        value.match(/^#[0-9a-fA-F]{3,6}$/) ||" +
            "                        value.match(/^rgb\\([^)]+\\)$/) ||" +
            "                        value.match(/^rgba\\([^)]+\\)$/) ||" +
            "                        value.match(/^hsl\\([^)]+\\)$/) ||" +
            "                        value.match(/^hsla\\([^)]+\\)$/)" +
            "                    )) {" +
            "                        if (value !== 'rgba(0, 0, 0, 0)' &&" +
            "                            value !== 'rgb(0, 0, 0)' &&" +
            "                            value !== 'rgb(255, 255, 255)' &&" +
            "                            value !== 'rgba(255, 255, 255, 1)' &&" +
            "                            value !== '#000000' &&" +
            "                            value !== '#ffffff' &&" +
            "                            value !== '#000' &&" +
            "                            value !== '#fff') {" +
            "                            shouldFlag = true;" +
            "                        }" +
            "                    } else if (property.includes('margin') || property.includes('padding')) {" +
            "                        if ((value.match(/^\\d+px$/) || value.match(/^\\d+\\.\\d+px$/)) && value !== '0px') {" +
            "                            shouldFlag = true;" +
            "                        }" +
            "                    } else if (property.includes('font-size') || property.includes('font-weight') || property.includes('line-height')) {" +
            "                        let shouldFlagTypography = false;" +
            "                        if (property.includes('font-size')) {" +
            "                            if (value.match(/^\\d+px$/) || value.match(/^\\d+\\.\\d+px$/)) {" +
            "                                shouldFlagTypography = true;" +
            "                            }" +
            "                        } else if (property.includes('font-weight')) {" +
            "                            if (value.match(/^\\d+$/)) {" +
            "                                shouldFlagTypography = true;" +
            "                            }" +
            "                        } else if (property.includes('line-height')) {" +
            "                            if (value.match(/^\\d+\\.\\d+$/) || " +
            "                                value.match(/^\\d+em$/) || " +
            "                                value.match(/^\\d+\\.\\d+em$/) || " +
            "                                value.match(/^\\d+%$/) || " +
            "                                value.match(/^\\d+\\.\\d+%$/) || " +
            "                                value.match(/^\\d+px$/) || " +
            "                                value.match(/^\\d+\\.\\d+px$/)) {" +
            "                                shouldFlagTypography = true;" +
            "                            }" +
            "                        }" +
            "                        if (shouldFlagTypography) {" +
            "                            shouldFlag = true;" +
            "                        }" +
            "                    } else if (property.includes('border-radius')) {" +
            "                        if (value.match(/^\\d+px$/) || value.match(/^\\d+\\.\\d+px$/)) {" +
            "                            shouldFlag = true;" +
            "                        }" +
            "                    }" +
            "" +
            "                    if (shouldFlag) {" +
            "                        const elementId = 'ds-lint-' + (++elementCounter);" +
            "                        element.setAttribute('data-ds-lint-id', elementId);" +
            "                        results[propertyInfo.category].push({" +
            "                            elementId: elementId," +
            "                            selector: getCssSelector(element)," +
            "                            property: propertyInfo.name," +
            "                            value: originalValue," +
            "                            path: getBreadcrumbs(element)," +
            "                            rule: ruleData.selector," +
            "                            stylesheet: sheet.href || 'inline'" +
            "                        });" +
            "                    }" +
            "                }" +
            "            });" +
            "        });" +
            "    });" +
            "" +
            "    return results;" +
            "})()",
            function(result, isException) {
                scannerState.style.display = 'none';
                
                if (isException) {
                    console.error('Token Inspector: Error scanning page:', isException);
                    return;
                }

                displayResults(result || []);
            }
        );
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
        const categories = ['Colors', 'Spacing', 'Typography', 'Radius'];
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

    function formatCssValue(value) {
        // Return the original value as-is to preserve the CSS format
        // This ensures hex values stay hex, rgb values stay rgb, etc.
        return value;
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

    startScan();
});