chrome.devtools.panels.create(
    "Token Inspector",
    null,
    "panel.html",
    function(panel) {
        console.log('Token Inspector DevTools: Panel created successfully');
        
        panel.onShown.addListener(function(window) {
            console.log('Token Inspector DevTools: Panel shown, injecting content script...');
            
            // Inject content script when panel is shown
            chrome.scripting.executeScript({
                target: { tabId: chrome.devtools.inspectedWindow.tabId },
                files: ['content.js']
            }).then(() => {
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
        
        panel.onHidden.addListener(function(window) {
            console.log('Token Inspector DevTools: Panel hidden');
        });
        
        // Also inject content script immediately when devtools is opened
        console.log('Token Inspector DevTools: Injecting content script on devtools open...');
        chrome.scripting.executeScript({
            target: { tabId: chrome.devtools.inspectedWindow.tabId },
            files: ['content.js']
        }).then(() => {
            console.log('Token Inspector DevTools: Initial content script injection successful');
        }).catch(err => {
            console.error('Token Inspector DevTools: Initial content script injection failed:', err);
            // This is expected for some URLs (like chrome://, file:// without permissions)
            // The panel will handle this gracefully
        });
    }
); 