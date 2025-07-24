chrome.devtools.panels.create(
    "Token Inspector",
    null,
    "panel.html",
    function(panel) {
        panel.onShown.addListener(function(window) {
            console.log('Token Inspector DevTools: Panel shown, injecting content script...');
            
            // Inject content script when panel is shown
            chrome.scripting.executeScript({
                target: { tabId: chrome.devtools.inspectedWindow.tabId },
                files: ['content.js']
            }).then(() => {
                console.log('Token Inspector DevTools: Content script injected successfully');
            }).catch(err => {
                console.log('Token Inspector DevTools: Content script injection error:', err);
            });
        });
    }
); 