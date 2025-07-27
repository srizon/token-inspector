/**
 * Token Inspector DevTools Integration Script
 * 
 * This script creates the DevTools panel and manages the integration between
 * the Chrome DevTools API and the Token Inspector extension.
 * 
 * Key Features:
 * - Creates a custom DevTools panel
 * - Manages content script injection timing
 * - Handles panel show/hide events
 * - Provides error handling for restricted pages
 * 
 * @version 2.0
 */

/**
 * Inject content script with proper error handling
 * Attempts to inject the content script and handles various failure scenarios
 * 
 * @returns {Promise} Promise that resolves when injection is successful or handled
 */
function injectContentScript() {
    return new Promise((resolve, reject) => {
        // First, check if we can access the current tab
        chrome.tabs.get(chrome.devtools.inspectedWindow.tabId, (tab) => {
            if (chrome.runtime.lastError) {
                console.warn('Token Inspector DevTools: Cannot access tab:', chrome.runtime.lastError.message);
                reject(new Error('Cannot access tab: ' + chrome.runtime.lastError.message));
                return;
            }

            // Check if the URL is injectable
            const url = tab.url || '';
            if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('devtools://')) {
                console.warn('Token Inspector DevTools: Cannot inject into restricted URL:', url);
                reject(new Error('Cannot inject into restricted URL: ' + url));
                return;
            }

            // Attempt to inject the content script
            chrome.scripting.executeScript({
                target: { tabId: chrome.devtools.inspectedWindow.tabId },
                files: ['content/content.js']
            }).then(() => {
                console.log('Token Inspector DevTools: Content script injection successful');
                resolve();
            }).catch(err => {
                console.error('Token Inspector DevTools: Content script injection failed:', err);
                reject(err);
            });
        });
    });
}

/**
 * Create the Token Inspector DevTools panel
 * This function is called when DevTools opens and sets up the panel interface
 */
chrome.devtools.panels.create(
    "Token Inspector", // Panel title
    null, // Icon path (null for default)
    "../panel/panel.html", // Panel HTML file
    function(panel) {
        console.log('Token Inspector DevTools: Panel created successfully');
        
        /**
         * Handle panel shown event
         * Injects content script when the panel becomes visible
         */
        panel.onShown.addListener(function(window) {
            console.log('Token Inspector DevTools: Panel shown, injecting content script...');
            
            // Inject content script when panel is shown
            injectContentScript().then(() => {
                console.log('Token Inspector DevTools: Content script injected successfully');
                
                // Wait a bit for the content script to initialize
                setTimeout(() => {
                    console.log('Token Inspector DevTools: Content script should be ready now');
                }, 500);
            }).catch(err => {
                console.error('Token Inspector DevTools: Content script injection error:', err);
                // Don't fail completely, just log the error
                // The panel will handle this gracefully
            });
        });
        
        /**
         * Handle panel hidden event
         * Cleanup when panel is hidden (optional)
         */
        panel.onHidden.addListener(function(window) {
            console.log('Token Inspector DevTools: Panel hidden');
        });
        
        /**
         * Inject content script immediately when devtools is opened
         * This ensures the content script is available as soon as possible
         */
        console.log('Token Inspector DevTools: Injecting content script on devtools open...');
        injectContentScript().then(() => {
            console.log('Token Inspector DevTools: Initial content script injection successful');
        }).catch(err => {
            console.error('Token Inspector DevTools: Initial content script injection failed:', err);
            // This is expected for some URLs (like chrome://, file:// without permissions)
            // The panel will handle this gracefully
        });
    }
); 