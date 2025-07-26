# Token Inspector

Token Inspector is a Chrome extension designed for developers and designers to inspect and analyze design tokens and hard-coded CSS values on any webpage. It helps ensure design system consistency by identifying violations in real time, with a focus on performance and usability.

## Features

- **Real-time Analysis**: Scans webpages for hard-coded CSS values that should use design tokens.
- **Categorized Results**: Organizes findings by design system categories (Colors, Typography, Spacing, Border).
- **Minimal, Modern UI**: Clean, accessible interface with tabbed navigation and detailed violation info.
- **DevTools Integration**: Adds a dedicated panel in Chrome DevTools for advanced analysis and element highlighting.
- **Inline CSS Editing**: Click-to-edit functionality for quick CSS value changes directly in the DevTools panel.
- **Change Management**: Track and revert applied CSS changes with built-in change history.
- **Shared Scanning Logic**: Consistent analysis across popup and DevTools via a shared module.
- **Performance Optimized**: Efficient scanning and caching for minimal page impact.
- **Test Files Included**: Comprehensive test files for various scenarios.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/srizon/token-inspector.git
   cd token-inspector
   ```
2. Open Chrome and go to `chrome://extensions/`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select the `token-inspector` directory.
5. The extension will appear in your Chrome toolbar.

## Usage

1. Navigate to any webpage you want to analyze.
2. Click the Token Inspector icon in your Chrome toolbar.
3. The extension scans the page and displays results by category.
4. For advanced analysis and editing, open Chrome DevTools and select the "Token Inspector" tab.
5. Click on any CSS value in the DevTools panel to edit it inline.

## Project Structure

```
token-inspector/
├── manifest.json              # Extension manifest
├── popup/                     # Popup UI and logic
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content/                   # Content script for page analysis
│   └── content.js
├── shared/                    # Shared scanning logic
│   └── shared-scanner.js
├── panel/                     # DevTools panel UI and logic
│   ├── panel.html
│   └── panel.js
├── devtools/                  # DevTools integration
│   ├── devtools.html
│   └── devtools.js
├── assets/                    # Category and navigation icons
│   ├── icon-color.svg         # Color category icon
│   ├── icon-text.svg          # Typography category icon
│   ├── icon-spacing.svg       # Spacing category icon
│   ├── icon-border.svg        # Border category icon
│   └── icon-caret.svg         # Caret icon for navigation
├── tests/                     # Test files for development
│   ├── simple-test.html       # Basic test scenarios
│   ├── complex-test.html      # Complex test scenarios
│   └── editing-test.html      # Inline editing test scenarios
├── flagged-variables.json     # Custom flagged variables
└── README.md                  # Project documentation
```

## Categories Analyzed

- **Colors**: Hard-coded color values (hex, rgb, rgba)
- **Typography**: Font sizes, font weights, line heights
- **Spacing**: Margins, paddings, gaps
- **Border**: Border radius values

## Test Files

- `tests/simple-test.html`: Basic test cases for common violations
- `tests/complex-test.html`: Complex scenarios with nested elements
- `tests/editing-test.html`: Test scenarios for inline editing functionality

## Performance

Token Inspector is optimized for speed and efficiency:
- Caching of CSS rules and selectors
- Early termination for irrelevant elements
- Optimized DOM traversal and element matching
- Limited breadcrumb depth for better performance
- Minimal memory footprint and non-blocking UI updates

## Changelog

### Version 1.9
- **Inline CSS Editing**: Added click-to-edit functionality in DevTools panel
  - Click any CSS value to edit it inline
  - Real-time validation of CSS value formats
  - Apply changes directly to the webpage
  - Visual feedback for successful/failed changes
- **Change Management System**: Track and manage applied CSS changes
  - Built-in change history tracking
  - Revert functionality for applied changes
  - Persistent change storage during session
- **Enhanced Element Finding**: Improved element location algorithms
  - Multiple fallback methods for element selection
  - Better handling of dynamic content
  - Escaped string handling for special characters
- **UI Improvements**: Enhanced editing interface
  - Hover states for editable values
  - Apply/Cancel buttons with proper styling
  - Status messages for user feedback
  - Keyboard shortcuts (Enter to apply, Escape to cancel)
- **CSS Validation**: Comprehensive CSS value validation
  - Property-specific validation rules
  - Support for CSS custom properties
  - Color format validation (hex, rgb, rgba, hsl, named colors)
  - Unit validation for numeric properties

### Version 1.8
- **Project Reorganization**: Restructured codebase into organized folders for better maintainability
  - Moved popup files to `popup/` directory
  - Moved content script to `content/` directory
  - Moved DevTools files to `devtools/` and `panel/` directories
  - Moved shared logic to `shared/` directory
  - Moved test files to `tests/` directory
- Updated gitignore with additional patterns for browser extensions and development
- Improved project structure documentation

### Version 1.7
- Improved summary styling, spacing, and transitions
- Enhanced highlighted state styling and visual hierarchy
- Test file improvements for consistency
- UI polish: refined spacing, borders, and overall visual consistency

### Version 1.6
- Enhanced breadcrumb system with better formatting and depth limiting
- Optimized category ordering in the UI
- Performance improvements for faster scanning
- UI refinements and code cleanup
- New caret icon for navigation
- Improved element selection and tracking

### Version 1.5
- Complete UI redesign with a minimal, modern look
- Added category-specific SVG icons
- Improved layout, typography, and spacing
- Better accessibility and keyboard navigation
- Modular CSS structure
- Performance optimizations and asset management

### Version 1.4
- Improved visual hierarchy and summary view
- Added category-specific icons
- Enhanced accessibility and keyboard navigation
- Better mobile responsiveness
- Modular CSS and improved test file organization

### Version 1.3
- Enhanced element highlighting with pulse animations
- Improved user experience and visual feedback
- Optimized styling for highlighting
- Code cleanup and streamlined project structure

### Version 1.2
- Support for flagged CSS custom properties
- Enhanced tooltips for element highlighting
- Added comprehensive test files for flagged variables
- Improved error handling and tooltip display

### Version 1.1
- Code cleanup and removal of unnecessary files
- Streamlined project structure
- Updated documentation
- Maintained performance optimizations
- Improved error handling and UI

---

**Token Inspector** – Helping teams build consistent, token-driven designs. 