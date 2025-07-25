/**
 * Token Inspector Content Script
 * 
 * This content script runs in the context of web pages and performs the actual scanning
 * for design token violations. It analyzes CSS properties and identifies hardcoded values
 * that should be replaced with design tokens.
 * 
 * Key Features:
 * - Scans all CSS rules and computed styles
 * - Identifies hardcoded colors, typography, spacing, and border values
 * - Flags specific CSS variables that should be replaced
 * - Provides element highlighting and tooltip functionality
 * - Maintains element mapping for accurate highlighting
 * 
 * @version 1.3
 */
(function() {
    // Use a namespace on the window object to avoid collisions and manage state.
    window.dsLint = window.dsLint || {};
    window.dsLint.elementMap = window.dsLint.elementMap || new Map();
    window.dsLint.isInitialized = window.dsLint.isInitialized || false;

    /**
     * Inspector Logic - Element Highlighting and Tooltip Management
     * This function is defined once and can be called by the persistent listener.
     * 
     * @param {string} elementId - Unique identifier for the element to highlight
     * @param {Object} issueData - Optional issue data for tooltip display
     */
    window.dsLint.inspectAndHighlight = (elementId, issueData = null) => {
        // Clear previous highlight and tooltip
        if (window.dsLint.highlightedElement) {
            try {
                window.dsLint.highlightedElement.style.outline = '';
                window.dsLint.highlightedElement.style.boxShadow = '';
                window.dsLint.highlightedElement.style.animation = '';
                window.dsLint.highlightedElement.classList.remove('ds-lint-highlight');
            } catch (e) { /* Element might have been removed */ }
        }
        
        // Remove existing tooltip
        const existingTooltip = document.querySelector('.ds-lint-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }

        // Try to find the element by data attribute first
        let targetElement = document.querySelector(`[data-ds-lint-id='${elementId}']`);
        
        // If not found, try to find it using the element map
        if (!targetElement && window.dsLint.elementMap.has(elementId)) {
            const elementInfo = window.dsLint.elementMap.get(elementId);
            try {
                targetElement = document.querySelector(elementInfo.selector);
            } catch (e) {
                console.log('Token Inspector: Invalid selector from map:', elementInfo.selector);
            }
        }
        
        // If still not found, try to find it in the stored results
        if (!targetElement && window.dsLint.scanResults) {
            for (const category in window.dsLint.scanResults) {
                const item = window.dsLint.scanResults[category].find(item => item.elementId === elementId);
                if (item && item.selector) {
                    try {
                        targetElement = document.querySelector(item.selector);
                        if (targetElement) {
                            // If we found the item in scan results, use its data for the tooltip
                            if (!issueData) {
                                issueData = item;
                            }
                            break;
                        }
                    } catch (e) {
                        console.log('Token Inspector: Invalid selector:', item.selector);
                    }
                }
            }
        }
        
        console.log('Token Inspector: Looking for element with ID:', elementId, 'Found:', !!targetElement);
        
        if (targetElement) {
            console.log('Token Inspector: Highlighting element:', targetElement);
            
            // Scroll to the element with smooth behavior
            targetElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'center'
            });
            
            // Add a persistent highlight effect with pulse animation
            targetElement.style.outline = '2px solid #FF3B30';
            targetElement.style.boxShadow = '0 0 15px rgba(255, 59, 48, 0.6)';
            targetElement.style.animation = 'ds-lint-pulse 2s ease-in-out infinite';
            
            // Add pulse animation keyframes if not already present
            if (!document.querySelector('#ds-lint-pulse-styles')) {
                const style = document.createElement('style');
                style.id = 'ds-lint-pulse-styles';
                style.textContent = `
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
                `;
                document.head.appendChild(style);
            }
            targetElement.style.zIndex = '9999';
            targetElement.style.position = 'relative';
            targetElement.classList.add('ds-lint-highlight');
            window.dsLint.highlightedElement = targetElement;

            // Show tooltip with issue details
            if (issueData) {
                const showTooltip = (element, issueData) => {
                    // Remove any existing tooltip
                    const existingTooltip = document.querySelector('.ds-lint-tooltip');
                    if (existingTooltip) {
                        existingTooltip.remove();
                    }

                    // Create tooltip element
                    const tooltip = document.createElement('div');
                    tooltip.className = 'ds-lint-tooltip';
                    tooltip.innerHTML = `<span class="property">${issueData.property}</span>: <span class="value">${issueData.value}</span>`;

                    // Add tooltip styles
                    tooltip.style.cssText = `
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
                    `;

                    // Style the property (blue)
                    const propertySpan = tooltip.querySelector('.property');
                    propertySpan.style.cssText = `
                        color: #9cdcfe;
                        font-weight: 500;
                    `;

                    // Style the value (orange)
                    const valueSpan = tooltip.querySelector('.value');
                    valueSpan.style.cssText = `
                        color: #ce9178;
                    `;

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
                    window.dsLint.currentTooltip = {
                        element: tooltip,
                        repositionHandler: repositionHandler
                    };
                };

                // Show tooltip with issue data
                showTooltip(targetElement, issueData);
            }
            
            // Remove highlight and tooltip after 30 seconds
            setTimeout(() => {
                if (targetElement.classList.contains('ds-lint-highlight')) {
                    targetElement.style.outline = '';
                    targetElement.style.boxShadow = '';
                    targetElement.style.animation = '';
                    targetElement.style.zIndex = '';
                    targetElement.style.position = '';
                    targetElement.classList.remove('ds-lint-highlight');
                    window.dsLint.highlightedElement = null;
                    
                    // Remove tooltip
                    const existingTooltip = document.querySelector('.ds-lint-tooltip');
                    if (existingTooltip) {
                        existingTooltip.remove();
                    }
                    
                    // Clean up tooltip event listeners
                    if (window.dsLint.currentTooltip) {
                        window.removeEventListener('resize', window.dsLint.currentTooltip.repositionHandler);
                        window.removeEventListener('scroll', window.dsLint.currentTooltip.repositionHandler);
                        window.dsLint.currentTooltip = null;
                    }
                }
            }, 30000);
        }
    };

    /**
     * Initialize the content script
     * Sets up message listeners and ensures the script is only initialized once
     */
    function initializeContentScript() {
        if (window.dsLint.isInitialized) {
            console.log('Token Inspector: Content script already initialized');
            return;
        }

        console.log('Token Inspector: Initializing content script...');
        
        // Attach the inspector listener only once per page load.
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Token Inspector: Received message:', request);
            
            if (request.action === 'ping') {
                console.log('Token Inspector: Responding to ping');
                sendResponse({ success: true, message: 'Content script is ready' });
            } else if (request.action === 'inspectElement') {
                window.dsLint.inspectAndHighlight(request.elementId, request.issueData);
                sendResponse({ success: true });
            } else if (request.action === 'runScan') {
                console.log('Token Inspector: Running scan...');
                
                // Run the scan
                const results = window.dsLint.runScan();
                
                // If we have immediate results, send them back
                if (results && Object.keys(results).length > 0) {
                    console.log('Token Inspector: Sending immediate results:', results);
                    sendResponse({ success: true, results: results });
                } else {
                    // Wait for scan to complete
                    const checkResults = setInterval(() => {
                        if (window.dsLint.finalResults) {
                            clearInterval(checkResults);
                            console.log('Token Inspector: Sending async results:', window.dsLint.finalResults);
                            sendResponse({ success: true, results: window.dsLint.finalResults });
                        }
                    }, 50);
                    
                    // Timeout after 5 seconds
                    setTimeout(() => {
                        clearInterval(checkResults);
                        console.log('Token Inspector: Scan timeout, sending empty results');
                        sendResponse({ success: false, error: 'Scan timeout', results: {} });
                    }, 5000);
                }
                return true; // Keep message channel open for async response
            } else if (request.action === 'clearHighlight') {
                window.dsLint.clearHighlight();
                sendResponse({ success: true });
            }
        });
        
        window.dsLint.isInitialized = true;
        console.log('Token Inspector: Content script initialized successfully');
        
        // Send ready signal to devtools/popup
        setTimeout(() => {
            console.log('Token Inspector: Sending ready signal...');
            chrome.runtime.sendMessage({ type: 'contentScriptReady' });
        }, 100);
    }

    /**
     * Clear highlight and tooltip from the page
     * Removes all visual indicators and cleans up event listeners
     */
    window.dsLint.clearHighlight = () => {
        if (window.dsLint.highlightedElement) {
            try {
                window.dsLint.highlightedElement.style.outline = '';
                window.dsLint.highlightedElement.style.boxShadow = '';
                window.dsLint.highlightedElement.style.animation = '';
                window.dsLint.highlightedElement.style.zIndex = '';
                window.dsLint.highlightedElement.style.position = '';
                window.dsLint.highlightedElement.classList.remove('ds-lint-highlight');
            } catch (e) { /* Element might have been removed */ }
            window.dsLint.highlightedElement = null;
        }
        
        // Remove tooltip
        const existingTooltip = document.querySelector('.ds-lint-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        // Clean up tooltip event listeners
        if (window.dsLint.currentTooltip) {
            window.removeEventListener('resize', window.dsLint.currentTooltip.repositionHandler);
            window.removeEventListener('scroll', window.dsLint.currentTooltip.repositionHandler);
            window.dsLint.currentTooltip = null;
        }
    };

    // Clear highlight when user clicks elsewhere or page reloads
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ds-lint-highlight')) {
            window.dsLint.clearHighlight();
        }
    });

    window.addEventListener('beforeunload', () => {
        window.dsLint.clearHighlight();
    });

    /**
     * Main Scan Function
     * This runs every time the content script is injected.
     * Performs the actual scanning of CSS properties and identifies violations.
     * 
     * @returns {Object} Scan results organized by category
     */
    window.dsLint.runScan = async function() {
        console.log('Token Inspector Content Script: runScan called');
        
        // 1. Cleanup old state from any previous scans
        document.querySelectorAll('[data-ds-lint-id]').forEach(el => el.removeAttribute('data-ds-lint-id'));
        if (window.dsLint.highlightedElement) {
            try {
                window.dsLint.highlightedElement.style.outline = '';
                window.dsLint.highlightedElement.style.boxShadow = '';
                window.dsLint.highlightedElement.style.animation = '';
                window.dsLint.highlightedElement.style.zIndex = '';
                window.dsLint.highlightedElement.style.position = '';
                window.dsLint.highlightedElement.classList.remove('ds-lint-highlight');
            } catch (e) {}
            window.dsLint.highlightedElement = null;
        }
        window.dsLint.elementMap.clear();

        // 2. Run the optimized scan
        console.log('Token Inspector Content Script: Running optimized scan...');
        const { findAndMarkElementsUsingVars, findHardcodedValues } = await setupOptimizedScanner();
        findAndMarkElementsUsingVars();
        const finalResults = findHardcodedValues();

        // 3. Store results for both popup and devtools
        window.dsLint.finalResults = finalResults;
        console.log('Token Inspector Content Script: Scan completed, results:', finalResults);
        
        // 4. Add a simple verification test
        console.log('Token Inspector Content Script: Verifying results...');
        const totalViolations = Object.values(finalResults).reduce((sum, items) => sum + items.length, 0);
        console.log('Token Inspector Content Script: Total violations found:', totalViolations);
        
        // Check for specific test violations
        const badElements = document.querySelectorAll('.bad-element-1, .bad-element-2, .bad-element-3');
        console.log('Token Inspector Content Script: Bad elements in DOM:', badElements.length);
        
        if (totalViolations === 0 && badElements.length > 0) {
            console.warn('Token Inspector Content Script: WARNING - Found bad elements but no violations detected!');
        }
        
        // Send results back to the requester (popup or devtools)
        chrome.runtime.sendMessage({ type: 'scanComplete', results: finalResults });
        
        // Return results for immediate response
        return finalResults;
    };
    
    /**
     * Optimized Scanner Setup
     * Creates an optimized scanning system with caching and efficient element processing
     * 
     * @returns {Promise<Object>} Promise resolving to scanner functions
     */
    function setupOptimizedScanner() {
        return new Promise((resolve, reject) => {
            const elementsUsingVar = new Map();
            let elementCounter = 0;
            let flaggedVariables = [];
            
            // Cache for expensive operations
            const selectorCache = new Map();
            const breadcrumbCache = new Map();
            const cssRulesCache = new Map();
            
            // Properties to check with their categories
            const propertiesToCheck = {
                'color': { name: 'color', category: 'Colors' },
                'background-color': { name: 'background-color', category: 'Colors' },
                'border-color': { name: 'border-color', category: 'Colors' },
                'border-top-color': { name: 'border-top-color', category: 'Colors' },
                'border-right-color': { name: 'border-right-color', category: 'Colors' },
                'border-bottom-color': { name: 'border-bottom-color', category: 'Colors' },
                'border-left-color': { name: 'border-left-color', category: 'Colors' },
                'font-size': { name: 'font-size', category: 'Typography' },
                'font-weight': { name: 'font-weight', category: 'Typography' },
                'line-height': { name: 'line-height', category: 'Typography' },
                'margin': { name: 'margin', category: 'Spacing' },
                'padding': { name: 'padding', category: 'Spacing' },
                'border-radius': { name: 'border-radius', category: 'Border' },
                'border-top-left-radius': { name: 'border-top-left-radius', category: 'Border' },
                'border-top-right-radius': { name: 'border-top-right-radius', category: 'Border' },
                'border-bottom-left-radius': { name: 'border-bottom-left-radius', category: 'Border' },
                'border-bottom-right-radius': { name: 'border-bottom-right-radius', category: 'Border' },
                'width': { name: 'width', category: 'Layout' },
                'height': { name: 'height', category: 'Layout' }
            };

            /**
             * Optimized CSS selector generation with caching
             * 
             * @param {Element} el - DOM element to generate selector for
             * @returns {string} CSS selector string
             */
            function getCssSelector(el) {
                const cacheKey = el.tagName + (el.id || '') + (el.className || '');
                if (selectorCache.has(cacheKey)) {
                    return selectorCache.get(cacheKey);
                }
                
                let selector;
                if (el.id) {
                    selector = `#${el.id}`;
                } else if (el.className) {
                    let classNames;
                    if (typeof el.className === 'string') {
                        classNames = el.className.split(' ').filter(c => c.trim());
                    } else if (el.className && el.className.length) {
                        classNames = Array.from(el.className).filter(c => c.trim());
                    }
                    
                    if (classNames && classNames.length > 0) {
                        selector = `${el.tagName.toLowerCase()}.${classNames.join('.')}`;
                    } else {
                        selector = el.tagName.toLowerCase();
                    }
                } else {
                    selector = el.tagName.toLowerCase();
                }
                
                selectorCache.set(cacheKey, selector);
                return selector;
            }

            /**
             * Optimized breadcrumb generation with caching
             * Creates a readable path showing element hierarchy
             * 
             * @param {Element} el - DOM element to generate breadcrumbs for
             * @returns {string} Breadcrumb string
             */
            function getBreadcrumbs(el) {
                if (breadcrumbCache.has(el)) {
                    return breadcrumbCache.get(el);
                }
                
                const breadcrumbs = [];
                let current = el;
                let depth = 0;
                const maxDepth = 3; // Limit to 3 levels for readability
                
                while (current && current !== document.body && depth < maxDepth) {
                    breadcrumbs.unshift(getCssSelector(current));
                    current = current.parentElement;
                    depth++;
                }
                
                const result = breadcrumbs.join(' › ');
                breadcrumbCache.set(el, result);
                return result;
            }

            /**
             * Track elements using CSS variables
             * 
             * @param {Element} element - DOM element using CSS variable
             * @param {string} property - CSS property name
             */
            function addVarUsage(element, property) {
                const key = `${element.tagName.toLowerCase()}-${property}`;
                if (!elementsUsingVar.has(key)) {
                    elementsUsingVar.set(key, []);
                }
                elementsUsingVar.get(key).push(element);
            }

            /**
             * Optimized CSS rule processing with caching and element matching
             * Processes all stylesheets and creates element-rule mappings
             * 
             * @returns {Object} Object containing rules and element-rule mapping
             */
            function processCssRules() {
                const rules = [];
                const elementRuleMap = new Map(); // Map elements to their applicable rules
                const stylesheets = Array.from(document.styleSheets);
                
                // First pass: collect all rules
                stylesheets.forEach((sheet, sheetIndex) => {
                    try {
                        const sheetRules = Array.from(sheet.cssRules || sheet.rules || []);
                        sheetRules.forEach((rule, ruleIndex) => {
                            if (rule.style) {
                                rules.push({
                                    rule: rule,
                                    selector: rule.selectorText,
                                    style: rule.style,
                                    sheetIndex: sheetIndex,
                                    ruleIndex: ruleIndex
                                });
                            }
                        });
                    } catch (e) {
                        // Cross-origin stylesheet, skip
                    }
                });
                
                // Second pass: pre-compute which elements match which rules
                const allElements = document.querySelectorAll('*');
                allElements.forEach(element => {
                    const elementRules = [];
                    rules.forEach(ruleData => {
                        try {
                            // Use matches() for more efficient element matching
                            if (element.matches && element.matches(ruleData.selector)) {
                                elementRules.push(ruleData);
                            }
                        } catch (e) {
                            // Invalid selector, skip
                        }
                    });
                    if (elementRules.length > 0) {
                        elementRuleMap.set(element, elementRules);
                    }
                });
                
                return { rules, elementRuleMap };
            }

            /**
             * Process styles for a single element
             * Analyzes CSS properties and identifies violations
             * 
             * @param {Element} element - DOM element to process
             * @param {CSSStyleDeclaration} style - Computed styles for the element
             * @param {Object} results - Results object to populate
             */
            function processElementStyles(element, style, results) {
                Object.keys(propertiesToCheck).forEach(property => {
                    const value = style.getPropertyValue(property).trim(); // Trim whitespace
                    
                    // Skip empty or inherited values
                    if (!value || value.startsWith('inherit') || value.startsWith('initial') || value === 'transparent' || value === 'currentColor') {
                        return;
                    }

                    console.log(`Token Inspector: Processing element <${element.tagName.toLowerCase()}>, property: ${property}, value: ${value}`);

                    const propertyInfo = propertiesToCheck[property];
                    let shouldFlag = false;
                    let category = '';
                    let flaggedValue = value;

                    if (value.startsWith('var(--')) {
                        // This is a CSS variable
                        addVarUsage(element, property);
                        
                        console.log('Token Inspector: Checking variable:', value, 'against flagged list:', flaggedVariables);
                        if (flaggedVariables.includes(value)) {
                            console.log('Token Inspector: MATCH FOUND! Flagging variable:', value);
                            shouldFlag = true;
                            category = propertyInfo.category; // Use the property's natural category instead of "Flagged Variables"
                            flaggedValue = value;
                        }
                    } else {
                        // This is a potential hardcoded value
                        let originalValue = value;
                        if (property.includes('color')) {
                            if (value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)) {
                                const rgbMatch = value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
                                const r = parseInt(rgbMatch[1]);
                                const g = parseInt(rgbMatch[2]);
                                const b = parseInt(rgbMatch[3]);
                                const toHex = (n) => { const hex = n.toString(16); return hex.length === 1 ? '0' + hex : hex; };
                                originalValue = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                            }
                        }

                        // Check for hardcoded values based on property type
                        if (property.includes('color') && (value.match(/^#[0-9a-fA-F]{3,6}$/) || value.match(/^rgb/) || value.match(/^hsl/))) {
                            if (value !== 'rgba(0, 0, 0, 0)' && value !== 'rgb(0, 0, 0)' && value !== 'rgb(255, 255, 255)' && value !== 'rgba(255, 255, 255, 1)' && value !== '#000000' && value !== '#ffffff' && value !== '#000' && value !== '#fff') {
                                shouldFlag = true;
                                category = 'Colors';
                                flaggedValue = originalValue;
                            }
                        } else if (property.includes('margin') || property.includes('padding')) {
                            if (value.match(/^\d+(\.\d+)?px$/) && value !== '0px') {
                                shouldFlag = true;
                                category = 'Spacing';
                            }
                        } else if (property.includes('font-size') || property.includes('font-weight') || property.includes('line-height')) {
                            if ((property.includes('font-size') && value.match(/^\d+(\.\d+)?px$/)) || (property.includes('font-weight') && value.match(/^\d+$/)) || (property.includes('line-height') && (value.match(/^\d/) || value.match(/^\d/)))) {
                                shouldFlag = true;
                                category = 'Typography';
                            }
                        } else if (property.includes('border-radius')) {
                            if (value.match(/^\d+(\.\d+)?px$/)) {
                                shouldFlag = true;
                                category = 'Border';
                            }
                        }
                    }

                    // If a value was flagged (either variable or hardcoded), add it to the results.
                    if (shouldFlag) {
                        console.log(`Token Inspector: Flagging element for ${category}: `, { selector: getCssSelector(element), property, value: flaggedValue });
                        
                        const elementId = `ds-lint-${++elementCounter}`;
                        element.setAttribute('data-ds-lint-id', elementId);
                        
                        window.dsLint.elementMap.set(elementId, {
                            selector: getCssSelector(element),
                            path: getBreadcrumbs(element)
                        });
                        
                        if (!window.dsLint.results) window.dsLint.results = {};
                        if (!window.dsLint.results[category]) {
                            window.dsLint.results[category] = [];
                        }
                        
                        window.dsLint.results[category].push({
                            elementId: elementId,
                            selector: getCssSelector(element),
                            property: propertyInfo.name,
                            value: flaggedValue,
                            path: getBreadcrumbs(element)
                        });
                    }
                });
            }

            /**
             * Find and mark elements using CSS variables
             * This function marks elements that are already using CSS custom properties
             * Reserved for future features
             */
            function findAndMarkElementsUsingVars() {
                // This function marks elements that are already using CSS custom properties
                // We'll implement this if needed for future features
            }

            /**
             * Find hardcoded values in the page
             * Main scanning function that processes all elements and their styles
             * 
             * @returns {Object} Results organized by category
             */
            function findHardcodedValues() {
                window.dsLint.results = {};
                
                // Get all CSS rules and element-rule mapping once
                const { rules, elementRuleMap } = processCssRules();
                
                // Process all elements efficiently using pre-computed rule mapping
                elementRuleMap.forEach((elementRules, element) => {
                    // Skip elements that are likely not relevant
                    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE' || 
                        element.tagName === 'NOSCRIPT' || element.tagName === 'META') {
                        return;
                    }
                    
                    // Process CSS rules for this element (already matched)
                    elementRules.forEach(ruleData => {
                        processElementStyles(element, ruleData.style, window.dsLint.results);
                    });
                });
                
                // Store results for highlighting purposes
                window.dsLint.scanResults = window.dsLint.results;
                
                return window.dsLint.results;
            }

            // Fetch the list of flagged variables
            fetch(chrome.runtime.getURL('flagged-variables.json'))
                .then(response => response.json())
                .then(data => {
                    flaggedVariables = data;
                    resolve({ findAndMarkElementsUsingVars, findHardcodedValues });
                })
                .catch(err => {
                    console.error('Token Inspector: Could not fetch or parse flagged-variables.json', err);
                    resolve({ findAndMarkElementsUsingVars, findHardcodedValues }); // Resolve anyway so the scan doesn't hang
                });
        });
    }

    // --- Initialize and Execute ---
    console.log('Token Inspector Content Script: Starting initialization...');
    
    // Initialize the content script
    initializeContentScript();
    
    // Add a simple test to verify the script is working
    console.log('Token Inspector Content Script: Testing basic functionality...');
    const testElements = document.querySelectorAll('.bad-element-1, .bad-element-2, .bad-element-3');
    console.log('Token Inspector Content Script: Found test elements:', testElements.length);
    
    // Don't run initial scan automatically - let popup/panel request it
    console.log('Token Inspector Content Script: Initialization complete, waiting for scan requests...');

})();