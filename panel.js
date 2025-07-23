document.addEventListener('DOMContentLoaded', function() {
    const scanButton = document.getElementById('scan-button');
    const scannerState = document.getElementById('scanner-state');
    const resultsContainer = document.getElementById('results-container');
    const noResultsMessage = document.getElementById('no-results-message');

    scanButton.addEventListener('click', startScan);

    function startScan() {
        scanButton.disabled = true;
        scannerState.style.display = 'flex';
        resultsContainer.style.display = 'none';
        noResultsMessage.style.display = 'none';

        // Get the inspected window
        chrome.devtools.inspectedWindow.eval(`
            (function() {
                // Get all stylesheets
                const stylesheets = Array.from(document.styleSheets);
                const hardcodedValues = [];
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
                                const properties = [
                                    // Color properties
                                    'color', 'background-color', 'border-color', 
                                    'border-top-color', 'border-right-color', 
                                    'border-bottom-color', 'border-left-color',
                                    // Typography properties
                                    'font-size', 'line-height', 'font-weight', 'font-family',
                                    'letter-spacing', 'text-align', 'text-decoration',
                                    // Spacing properties
                                    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
                                    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
                                    // Layout properties
                                    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'
                                ];
                                
                                properties.forEach(property => {
                                    const value = style.getPropertyValue(property);
                                    if (value && value.trim() && 
                                        !value.startsWith('var(--') && 
                                        !value.startsWith('inherit') && 
                                        !value.startsWith('initial') &&
                                        value !== 'transparent' && 
                                        value !== 'currentColor' &&
                                        value !== 'auto' &&
                                        value !== 'normal' &&
                                        value !== 'none') {
                                        
                                        // For color properties, check if it's a hardcoded color
                                        const isColorProperty = property.includes('color');
                                        const isHardcodedColor = isColorProperty && (
                                            value.match(/^#[0-9a-fA-F]{3,6}$/) ||
                                            value.match(/^rgb\\([^)]+\\)$/) ||
                                            value.match(/^rgba\\([^)]+\\)$/) ||
                                            value.match(/^hsl\\([^)]+\\)$/) ||
                                            value.match(/^hsla\\([^)]+\\)$/)
                                        );
                                        
                                        // For non-color properties, check if it's a hardcoded value (not using design tokens)
                                        const isHardcodedValue = !isColorProperty && 
                                            !value.startsWith('var(--') && 
                                            !value.startsWith('calc(') &&
                                            !value.startsWith('clamp(') &&
                                            !value.startsWith('min(') &&
                                            !value.startsWith('max(');
                                        
                                        if (isColorProperty ? isHardcodedColor : isHardcodedValue) {
                                        
                                        // Find elements that match this rule
                                        try {
                                            const elements = document.querySelectorAll(rule.selectorText);
                                            elements.forEach(element => {
                                                const elementId = 'ds-lint-' + (++elementCounter);
                                                element.setAttribute('data-ds-lint-id', elementId);
                                                
                                                hardcodedValues.push({
                                                    elementId: elementId,
                                                    selector: getCssSelector(element),
                                                    property: property.replace('-', ' ').replace(/\\b\\w/g, l => l.toUpperCase()),
                                                    value: value,
                                                    path: getBreadcrumbs(element),
                                                    rule: rule.selectorText,
                                                    stylesheet: sheet.href || 'inline'
                                                });
                                            });
                                        } catch (e) {
                                            // Invalid selector, skip
                                        }
                                    }
                                });
                            }
                        });
                    } catch (e) {
                        // Cross-origin stylesheet, skip
                    }
                });

                return hardcodedValues;
            })()
        `, function(result, isException) {
            scanButton.disabled = false;
            scannerState.style.display = 'none';
            
            if (isException) {
                console.error('DS-Lint: Error scanning page:', isException);
                return;
            }

            displayResults(result || []);
        });
    }

    function displayResults(results) {
        resultsContainer.innerHTML = '';

        if (results.length === 0) {
            noResultsMessage.style.display = 'flex';
            return;
        }

        // Group by property type first, then by element selector
        const grouped = {};
        results.forEach(item => {
            let category;
            if (item.property.includes('Color')) {
                category = 'Hardcoded Colors';
            } else if (item.property.includes('Font') || item.property.includes('Line') || item.property.includes('Letter') || item.property.includes('Text')) {
                category = 'Typography Issues';
            } else if (item.property.includes('Margin') || item.property.includes('Padding')) {
                category = 'Spacing Issues';
            } else if (item.property.includes('Width') || item.property.includes('Height')) {
                category = 'Layout Issues';
            } else {
                category = 'Other Properties';
            }
            if (!grouped[category]) {
                grouped[category] = {};
            }
            
            // Create a unique key for each selector
            const issueKey = item.selector;
            if (!grouped[category][issueKey]) {
                grouped[category][issueKey] = {
                    selector: item.selector,
                    path: item.path,
                    properties: [], // Simple array of property objects
                    elementIds: new Set() // Track unique element IDs
                };
            }
            
            // Add the property if it doesn't exist
            const existingProperty = grouped[category][issueKey].properties.find(p => 
                p.property === item.property && p.value === item.value
            );
            
            if (!existingProperty) {
                grouped[category][issueKey].properties.push({
                    property: item.property,
                    value: item.value
                });
            }
            
            // Add element ID
            grouped[category][issueKey].elementIds.add(item.elementId);
        });

        Object.keys(grouped).forEach(category => {
            const elementGroups = Object.values(grouped[category]);
            const allIssues = [];
            
            // Convert to the format expected by createIssueCard
            elementGroups.forEach(elementGroup => {
                allIssues.push({
                    selector: elementGroup.selector,
                    path: elementGroup.path,
                    properties: elementGroup.properties,
                    elements: Array.from(elementGroup.elementIds).map(elementId => ({ elementId }))
                });
            });
            
            const section = createCategorySection(category, allIssues);
            resultsContainer.appendChild(section);
        });

        resultsContainer.style.display = 'block';
        
        // Open the first category by default
        const firstHeader = resultsContainer.querySelector('.category-header');
        if (firstHeader) firstHeader.click();
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

    function createIssueCard(issueData) {
        const li = document.createElement('li');
        li.className = 'result-item-card';
        
        // Show count if multiple elements are affected
        const countBadge = issueData.elements.length > 1 ? 
            `<span class="element-count">${issueData.elements.length} elements</span>` : '';

        // Create property list as inline text
        const propertyText = issueData.properties.map(prop => 
            `${prop.property}: ${prop.value}`
        ).join('; ');

        li.innerHTML = `
            <div class="item-header">
                <div class="item-selector" title="${issueData.selector}">${issueData.selector}</div>
                ${countBadge}
            </div>
            <div class="item-properties">
                <span class="property-text">${propertyText}</span>
            </div>
            <div class="item-path" title="${issueData.path}">${issueData.path}</div>
        `;

        li.addEventListener('click', () => {
            // Highlight all affected elements
            const elementIds = issueData.elements.map(el => el.elementId);
            
            chrome.devtools.inspectedWindow.eval(`
                (function() {
                    // Clear previous highlights
                    const prevHighlights = document.querySelectorAll('.ds-lint-highlight');
                    prevHighlights.forEach(el => {
                        el.style.outline = '';
                        el.style.boxShadow = '';
                        el.style.backgroundColor = '';
                        el.classList.remove('ds-lint-highlight');
                    });
                    
                    // Highlight all affected elements
                    const elementIds = ${JSON.stringify(elementIds)};
                    let firstElement = null;
                    
                    elementIds.forEach(elementId => {
                        const element = document.querySelector('[data-ds-lint-id="' + elementId + '"]');
                        if (element) {
                            element.style.outline = '3px solid #007AFF';
                            element.style.boxShadow = '0 0 20px rgba(0, 122, 255, 0.7)';
                            element.style.backgroundColor = 'rgba(0, 122, 255, 0.1)';
                            element.classList.add('ds-lint-highlight');
                            
                            if (!firstElement) {
                                firstElement = element;
                            }
                        }
                    });
                    
                    // Scroll to first element if found
                    if (firstElement) {
                        firstElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center',
                            inline: 'center'
                        });
                    }
                    
                    // Remove highlights after 3 seconds
                    setTimeout(() => {
                        const highlights = document.querySelectorAll('.ds-lint-highlight');
                        highlights.forEach(el => {
                            el.style.outline = '';
                            el.style.boxShadow = '';
                            el.style.backgroundColor = '';
                            el.classList.remove('ds-lint-highlight');
                        });
                    }, 3000);
                })()
            `);
        });
        
        return li;
    }
}); 