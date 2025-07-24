// Shared Token Inspector Scanner Logic
// This module contains the common functionality used by both popup and devtools

class TokenInspectorScanner {
    constructor(options = {}) {
        this.isDevTools = options.isDevTools || false;
        this.onResultsReady = options.onResultsReady || (() => {});
        this.onScanStart = options.onScanStart || (() => {});
        this.onScanComplete = options.onScanComplete || (() => {});
        this.onError = options.onError || (() => {});
    }

    // Start the scanning process
    startScan() {
        this.onScanStart();
        
        if (this.isDevTools) {
            this.scanWithDevTools();
        } else {
            this.scanWithContentScript();
        }
    }

    // Scan using DevTools API (for devtools panel)
    scanWithDevTools() {
        console.log('Token Inspector DevTools: Starting scan...');
        
        // Use the same approach as popup - inject content script and send message
        chrome.scripting.executeScript({
            target: { tabId: chrome.devtools.inspectedWindow.tabId },
            files: ['content.js']
        }).then(() => {
            console.log('Token Inspector DevTools: Content script injected, sending runScan message...');
            
            // Wait a bit for the script to initialize, then send message
            setTimeout(() => {
                chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, { action: 'runScan' })
                    .then(response => {
                        console.log('Token Inspector DevTools: Scan message sent, response:', response);
                        if (response && response.success && response.results) {
                            // Results received immediately
                            this.onScanComplete();
                            this.onResultsReady(response.results);
                        } else {
                            // Wait for async results via message listener
                            console.log('Token Inspector DevTools: Waiting for async scan results...');
                        }
                    })
                    .catch(err => {
                        console.error('Token Inspector DevTools: Error sending scan message:', err);
                        this.onError(err);
                    });
            }, 200); // Increased wait time for content script initialization
        }).catch(err => {
            console.log('Token Inspector DevTools: Content script injection failed:', err);
            this.onError(err);
        });
    }

    // Scan using content script (for popup)
    scanWithContentScript() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                this.onError('No active tab found');
                return;
            }
            
            const tabId = tabs[0].id;
            
            // Inject content script and run scan
            chrome.scripting.executeScript({ 
                target: { tabId: tabId }, 
                files: ['content.js'] 
            }, () => {
                // Wait a bit for the script to initialize
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { action: 'runScan' })
                        .then(response => {
                            console.log('Token Inspector Popup: Scan message sent, response:', response);
                            if (response && response.success && response.results) {
                                // Results received immediately
                                this.onScanComplete();
                                this.onResultsReady(response.results);
                            } else {
                                // Wait for async results via message listener
                                console.log('Token Inspector Popup: Waiting for async scan results...');
                            }
                        })
                        .catch(err => {
                            console.error('Token Inspector Popup: Error sending scan message:', err);
                            this.onError(err);
                        });
                }, 100);
            });
        });
    }

    // Display results in the UI
    displayResults(results, container, noResultsElement) {
        container.innerHTML = '';

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

        // Check if we have any results
        const totalIssues = Object.values(results).reduce((sum, items) => sum + items.length, 0);
        if (totalIssues === 0) {
            if (noResultsElement) {
                noResultsElement.style.display = 'flex';
            }
            return;
        }

        // Display all categories
        container.style.display = 'block';
        if (noResultsElement) {
            noResultsElement.style.display = 'none';
        }

        Object.keys(results).forEach(category => {
            const items = results[category];
            if (items.length > 0) {
                const section = this.createCategorySection(category, items);
                container.appendChild(section);
            }
        });
    }

    // Create a category section
    createCategorySection(category, items) {
        const section = document.createElement('div');
        section.className = 'category-section';

        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `<span class="category-title">${category}</span><span class="category-count">${items.length}</span>`;

        const list = document.createElement('ul');
        list.className = 'results-list';

        items.forEach(itemData => {
            const card = this.createIssueCard(itemData);
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

    // Create an issue card
    createIssueCard(itemData) {
        const li = document.createElement('li');
        li.className = 'result-item-card';
        
        // Format the property name for display
        const propertyName = itemData.property.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        li.innerHTML = `
            <div class="item-header">
                <div class="item-selector" title="${itemData.selector}">${itemData.selector}</div>
            </div>
            <div class="item-properties">
                <span class="property-text">${propertyName}: ${itemData.value}</span>
            </div>
            <div class="item-path" title="${itemData.path}">${itemData.path}</div>
        `;

        li.addEventListener('click', () => {
            this.highlightElement(itemData);
        });
        
        return li;
    }

    // Highlight element on the page
    highlightElement(itemData) {
        if (this.isDevTools) {
            // Use DevTools API for highlighting
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
                    
                    // Highlight the element
                    const element = document.querySelector('[data-ds-lint-id="${itemData.elementId}"]');
                    if (element) {
                        element.style.outline = '3px solid #007AFF';
                        element.style.boxShadow = '0 0 20px rgba(0, 122, 255, 0.7)';
                        element.style.backgroundColor = 'rgba(0, 122, 255, 0.1)';
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
                                element.classList.remove('ds-lint-highlight');
                            }
                        }, 3000);
                    }
                })()
            `);
        } else {
            // Use content script for highlighting
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, { 
                        action: 'inspectElement', 
                        elementId: itemData.elementId 
                    });
                }
            });
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TokenInspectorScanner;
} 