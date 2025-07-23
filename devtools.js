chrome.devtools.panels.create(
    "DS-Lint",
    null,
    "panel.html",
    function(panel) {
        panel.onShown.addListener(function(window) {
            // Panel is shown
        });
    }
); 