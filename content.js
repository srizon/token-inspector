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
                console.log('DS-Lint: Invalid selector from map:', elementInfo.selector);
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
                        console.log('DS-Lint: Invalid selector:', item.selector);
                    }
                }
            }
        }
        
        console.log('DS-Lint: Looking for element with ID:', elementId, 'Found:', !!targetElement);
        
        if (targetElement) {
            console.log('DS-Lint: Highlighting element:', targetElement);
            
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
            console.log('DS-Lint: Could not find element with ID:', elementId);
        }
    };

    // Attach the inspector listener only once per page load.
    if (!window.dsLint.listenerAttached) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('DS-Lint: Received message:', request);
            if (request.action === 'inspectElement') {
                window.dsLint.inspectAndHighlight(request.elementId);
                sendResponse({ success: true });
            } else if (request.action === 'runScan') {
                runScan();
                sendResponse({ success: true });
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
    function runScan() {
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

        // 2. Run the full, comprehensive scan
        const { findAndMarkElementsUsingVars, findHardcodedValues } = setupScanner();
        findAndMarkElementsUsingVars();
        const finalResults = findHardcodedValues();

        // 3. Send the results back to the popup
        chrome.runtime.sendMessage({ type: 'scanComplete', results: finalResults });
    }
    
    // --- Scanner Setup ---
    // Encapsulates all scanning logic to keep the main function clean.
    function setupScanner() {
        const elementsUsingVar = new Map();
        let elementCounter = 0;
        const defaultStylesCache = {};
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        const defaultView = iframe.contentWindow;

        function getTrueDefaultStyle(tagName) {
            if (defaultStylesCache[tagName]) {
                return defaultStylesCache[tagName];
            }
            
            const tempElement = defaultView.document.createElement(tagName);
            defaultView.document.body.appendChild(tempElement);
            const computedStyle = defaultView.getComputedStyle(tempElement);
            const defaultStyle = {
                color: computedStyle.color,
                backgroundColor: computedStyle.backgroundColor,
                borderColor: computedStyle.borderColor
            };
            defaultView.document.body.removeChild(tempElement);
            defaultStylesCache[tagName] = defaultStyle;
            return defaultStyle;
        }

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
            'border-bottom-right-radius': { name: 'Border Bottom Right Radius', category: 'Radius' },
            'width': { name: 'Width', category: 'Layout' },
            'height': { name: 'Height', category: 'Layout' }
        };

        function getCssSelector(el) {
            if (el.id) return `#${el.id}`;
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
                    return `${el.tagName.toLowerCase()}.${classNames.join('.')}`;
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

        function addVarUsage(element, property) {
            const key = `${element.tagName.toLowerCase()}-${property}`;
            if (!elementsUsingVar.has(key)) {
                elementsUsingVar.set(key, []);
            }
            elementsUsingVar.get(key).push(element);
        }

        function findStylesInNode(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node;
                const tagName = element.tagName.toLowerCase();
                
                // Get all stylesheets and check CSS rules directly
                const stylesheets = Array.from(document.styleSheets);
                
                stylesheets.forEach((sheet, sheetIndex) => {
                    try {
                        const rules = Array.from(sheet.cssRules || sheet.rules || []);
                        
                        rules.forEach((rule, ruleIndex) => {
                            if (rule.style) {
                                const style = rule.style;
                                
                                // Check if this element matches the rule
                                try {
                                    const matchingElements = document.querySelectorAll(rule.selectorText);
                                    if (Array.from(matchingElements).includes(element)) {
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
                                                        const propertyMatch = new RegExp(`${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;]+)`, 'i');
                                                        const match = cssText.match(propertyMatch);
                                                        if (match && match[1]) {
                                                            const extractedValue = match[1].trim();
                                                            // If the extracted value is in hex format, use it
                                                            if (extractedValue.match(/^#[0-9a-fA-F]{3,6}$/)) {
                                                                originalValue = extractedValue;
                                                            }
                                                        }
                                                    } catch (e) {
                                                        // Fall back to the computed value
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
                                                        category = 'Colors';
                                                    }
                                                }
                                                // Check for hardcoded spacing values
                                                else if (property.includes('margin') || property.includes('padding')) {
                                                    if (value.match(/^\d+px$/) || value.match(/^\d+\.\d+px$/)) {
                                                        shouldFlag = true;
                                                        category = 'Spacing';
                                                    }
                                                }
                                                // Check for hardcoded typography values
                                                else if (property.includes('font-size') || property.includes('font-weight') || property.includes('line-height')) {
                                                    if (value.match(/^\d+px$/) || value.match(/^\d+\.\d+px$/) || value.match(/^\d+$/)) {
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
                                                    
                                                    // Debug: Log the element that was marked
                                                    console.log('DS-Lint: Marked element', elementId, 'with value', value, 'for property', property);
                                                }
                                            } else if (value && value.startsWith('var(--')) {
                                                // This element is using CSS variables - mark it as such
                                                addVarUsage(element, property);
                                            }
                                        });
                                    }
                                } catch (e) {
                                    // Invalid selector, skip
                                }
                            }
                        });
                    } catch (e) {
                        // Cross-origin stylesheet, skip
                    }
                });
            }
            
            // Recursively check child nodes
            for (let child of node.childNodes) {
                findStylesInNode(child);
            }
        }

        function findAndMarkElementsUsingVars() {
            // This function marks elements that are already using CSS custom properties
            // We'll implement this if needed for future features
        }

        function findHardcodedValues() {
            window.dsLint.results = {};
            findStylesInNode(document.body);
            document.body.removeChild(iframe);
            
            // Store results for highlighting purposes
            window.dsLint.scanResults = window.dsLint.results;
            
            return window.dsLint.results;
        }

        return { findAndMarkElementsUsingVars, findHardcodedValues };
    }

    // --- Execute Scan ---
    runScan();

})();