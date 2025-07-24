chrome.devtools.panels.create(
    "Token Inspector",
    null,
    "panel.html",
    function(panel) {
        panel.onShown.addListener(function(window) {
            // Panel is shown
        });
    }
); 