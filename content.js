(function() {
    // Use a namespace on the window object to avoid collisions and manage state.
    window.dsLint = window.dsLint || {};
    window.dsLint.elementMap = window.dsLint.elementMap || new Map();

    // --- Inspector Logic ---
    // This function is defined once and can be called by the persistent listener.
    window.dsLint.inspectAndHighlight = (elementId) => {
        // Clear previous highlight
        if (window.dsLint.highlightedElement) {
            try {
                window.dsLint.highlightedElement.style.outline = '';
                window.dsLint.highlightedElement.style.boxShadow = '';
                window.dsLint.highlightedElement.style.backgroundColor = '';
                window.dsLint.highlightedElement.classList.remove('ds-lint-highlight');
            } catch (e) { /* Element might have been removed */ }
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
                        if (targetElement) break;
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
            
            // Add a persistent highlight effect
            targetElement.style.outline = '4px solid #FF3B30';
            targetElement.style.boxShadow = '0 0 25px rgba(255, 59, 48, 0.8)';
            targetElement.style.backgroundColor = 'rgba(255, 59, 48, 0.15)';
            targetElement.style.zIndex = '9999';
            targetElement.style.position = 'relative';
            targetElement.classList.add('ds-lint-highlight');
            window.dsLint.highlightedElement = targetElement;
        } else {
            console.log('Token Inspector: Could not find element with ID:', elementId);
        }
    };

    // Attach the inspector listener only once per page load.
    if (!window.dsLint.listenerAttached) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Token Inspector: Received message:', request);
            if (request.action === 'inspectElement') {
                window.dsLint.inspectAndHighlight(request.elementId);
                sendResponse({ success: true });
            } else if (request.action === 'runScan') {
                window.dsLint.runScan();
                // Return results immediately if available, otherwise wait for scan to complete
                if (window.dsLint.finalResults) {
                    sendResponse({ success: true, results: window.dsLint.finalResults });
                } else {
                    // Wait for scan to complete
                    const checkResults = setInterval(() => {
                        if (window.dsLint.finalResults) {
                            clearInterval(checkResults);
                            sendResponse({ success: true, results: window.dsLint.finalResults });
                        }
                    }, 50);
                    
                    // Timeout after 5 seconds
                    setTimeout(() => {
                        clearInterval(checkResults);
                        sendResponse({ success: false, error: 'Scan timeout' });
                    }, 5000);
                }
                return true; // Keep message channel open for async response
            } else if (request.action === 'clearHighlight') {
                window.dsLint.clearHighlight();
                sendResponse({ success: true });
            }
        });
        window.dsLint.listenerAttached = true;
    }

    // Add function to clear highlight
    window.dsLint.clearHighlight = () => {
        if (window.dsLint.highlightedElement) {
            try {
                window.dsLint.highlightedElement.style.outline = '';
                window.dsLint.highlightedElement.style.boxShadow = '';
                window.dsLint.highlightedElement.style.backgroundColor = '';
                window.dsLint.highlightedElement.style.zIndex = '';
                window.dsLint.highlightedElement.style.position = '';
                window.dsLint.highlightedElement.classList.remove('ds-lint-highlight');
            } catch (e) { /* Element might have been removed */ }
            window.dsLint.highlightedElement = null;
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

    // --- Main Scan Function ---
    // This runs every time the content script is injected.
    window.dsLint.runScan = function() {
        console.log('Token Inspector Content Script: runScan called');
        
        // 1. Cleanup old state from any previous scans
        document.querySelectorAll('[data-ds-lint-id]').forEach(el => el.removeAttribute('data-ds-lint-id'));
        if (window.dsLint.highlightedElement) {
            try {
                window.dsLint.highlightedElement.style.outline = '';
                window.dsLint.highlightedElement.style.boxShadow = '';
                window.dsLint.highlightedElement.style.backgroundColor = '';
                window.dsLint.highlightedElement.style.zIndex = '';
                window.dsLint.highlightedElement.style.position = '';
                window.dsLint.highlightedElement.classList.remove('ds-lint-highlight');
            } catch (e) {}
            window.dsLint.highlightedElement = null;
        }
        window.dsLint.elementMap.clear();

        // 2. Run the optimized scan
        console.log('Token Inspector Content Script: Running optimized scan...');
        const { findAndMarkElementsUsingVars, findHardcodedValues } = setupOptimizedScanner();
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
    };
    
    // --- Optimized Scanner Setup ---
    function setupOptimizedScanner() {
        const elementsUsingVar = new Map();
        let elementCounter = 0;
        
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
            'border-radius': { name: 'border-radius', category: 'Radius' },
            'border-top-left-radius': { name: 'border-top-left-radius', category: 'Radius' },
            'border-top-right-radius': { name: 'border-top-right-radius', category: 'Radius' },
            'border-bottom-left-radius': { name: 'border-bottom-left-radius', category: 'Radius' },
            'border-bottom-right-radius': { name: 'border-bottom-right-radius', category: 'Radius' },
            'width': { name: 'width', category: 'Layout' },
            'height': { name: 'height', category: 'Layout' }
        };

        // Optimized CSS selector generation with caching
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

        // Optimized breadcrumb generation with caching
        function getBreadcrumbs(el) {
            if (breadcrumbCache.has(el)) {
                return breadcrumbCache.get(el);
            }
            
            const breadcrumbs = [];
            let current = el;
            let depth = 0;
            const maxDepth = 10; // Prevent infinite loops
            
            while (current && current !== document.body && depth < maxDepth) {
                breadcrumbs.unshift(getCssSelector(current));
                current = current.parentElement;
                depth++;
            }
            
            const result = breadcrumbs.join(' > ');
            breadcrumbCache.set(el, result);
            return result;
        }

        function addVarUsage(element, property) {
            const key = `${element.tagName.toLowerCase()}-${property}`;
            if (!elementsUsingVar.has(key)) {
                elementsUsingVar.set(key, []);
            }
            elementsUsingVar.get(key).push(element);
        }

        // Optimized CSS rule processing with caching and element matching
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



        // Process styles for a single element
        function processElementStyles(element, style, results) {
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
                        if (value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)) {
                            const rgbMatch = value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
                            const r = parseInt(rgbMatch[1]);
                            const g = parseInt(rgbMatch[2]);
                            const b = parseInt(rgbMatch[3]);
                            
                            const toHex = (n) => {
                                const hex = n.toString(16);
                                return hex.length === 1 ? '0' + hex : hex;
                            };
                            
                            const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                            originalValue = hexColor;
                        } else if (value.match(/^rgba\([^)]+\)$/)) {
                            originalValue = value;
                        } else {
                            originalValue = value;
                        }
                    }
                    
                    const propertyInfo = propertiesToCheck[property];
                    let shouldFlag = false;
                    let category = '';
                    
                    // Check for hardcoded colors
                    if (property.includes('color') && (
                        value.match(/^#[0-9a-fA-F]{3,6}$/) ||
                        value.match(/^rgb\([^)]+\)$/) ||
                        value.match(/^rgba\([^)]+\)$/) ||
                        value.match(/^hsl\([^)]+\)$/) ||
                        value.match(/^hsla\([^)]+\)$/)
                    )) {
                        if (value !== 'rgba(0, 0, 0, 0)' &&
                            value !== 'rgb(0, 0, 0)' &&
                            value !== 'rgb(255, 255, 255)' &&
                            value !== 'rgba(255, 255, 255, 1)' &&
                            value !== '#000000' &&
                            value !== '#ffffff' &&
                            value !== '#000' &&
                            value !== '#fff') {
                            shouldFlag = true;
                            category = 'Colors';
                        }
                    }
                    // Check for hardcoded spacing values
                    else if (property.includes('margin') || property.includes('padding')) {
                        if ((value.match(/^\d+px$/) || value.match(/^\d+\.\d+px$/)) && value !== '0px') {
                            shouldFlag = true;
                            category = 'Spacing';
                        }
                    }
                    // Check for hardcoded typography values
                    else if (property.includes('font-size') || property.includes('font-weight') || property.includes('line-height')) {
                        let shouldFlagTypography = false;
                        
                        if (property.includes('font-size')) {
                            if (value.match(/^\d+px$/) || value.match(/^\d+\.\d+px$/)) {
                                shouldFlagTypography = true;
                            }
                        } else if (property.includes('font-weight')) {
                            if (value.match(/^\d+$/)) {
                                shouldFlagTypography = true;
                            }
                        } else if (property.includes('line-height')) {
                            if (value.match(/^\d+\.\d+$/) || 
                                value.match(/^\d+em$/) || 
                                value.match(/^\d+\.\d+em$/) || 
                                value.match(/^\d+%$/) || 
                                value.match(/^\d+\.\d+%$/) || 
                                value.match(/^\d+px$/) || 
                                value.match(/^\d+\.\d+px$/)) {
                                shouldFlagTypography = true;
                            }
                        }
                        
                        if (shouldFlagTypography) {
                            shouldFlag = true;
                            category = 'Typography';
                        }
                    }
                    // Check for hardcoded border radius values
                    else if (property.includes('border-radius')) {
                        if (value.match(/^\d+px$/) || value.match(/^\d+\.\d+px$/)) {
                            shouldFlag = true;
                            category = 'Radius';
                        }
                    }
                    
                    if (shouldFlag) {
                        const elementId = `ds-lint-${++elementCounter}`;
                        element.setAttribute('data-ds-lint-id', elementId);
                        
                        // Store mapping for highlighting
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
                            value: originalValue,
                            path: getBreadcrumbs(element)
                        });
                    } else if (value && value.startsWith('var(--')) {
                        addVarUsage(element, property);
                    }
                }
            });
        }

        function findAndMarkElementsUsingVars() {
            // This function marks elements that are already using CSS custom properties
            // We'll implement this if needed for future features
        }

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

        return { findAndMarkElementsUsingVars, findHardcodedValues };
    }

    // --- Execute Scan ---
    console.log('Token Inspector Content Script: Initializing...');
    console.log('Token Inspector Content Script: runScan function available:', typeof window.dsLint.runScan);
    
    // Add a simple test to verify the script is working
    console.log('Token Inspector Content Script: Testing basic functionality...');
    const testElements = document.querySelectorAll('.bad-element-1, .bad-element-2, .bad-element-3');
    console.log('Token Inspector Content Script: Found test elements:', testElements.length);
    
    window.dsLint.runScan();

})();