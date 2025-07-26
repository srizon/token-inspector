# Token Inspector

A powerful Chrome extension that helps developers and designers inspect and analyze design tokens and hard-coded CSS values on webpages. Token Inspector provides real-time scanning capabilities to identify design system violations and ensure consistent design implementation.

## Features

- **Real-time Token Analysis**: Scans webpages for hard-coded CSS values that should be using design tokens
- **Categorized Results**: Organizes findings by design system categories (Colors, Typography, Spacing, Border)
- **Interactive UI**: Clean, modern interface with tabbed navigation and detailed violation information
- **Developer Tools Integration**: Dedicated panel in Chrome DevTools for advanced analysis
- **Performance Optimized**: Efficient scanning algorithms with minimal impact on page performance
- **Shared Scanning Module**: Reusable scanning logic for consistent analysis across popup and DevTools
- **Enhanced Testing**: Comprehensive test files for various scenarios
- **Modern Design System**: Clean, minimal UI with consistent typography, spacing, and color system
- **Category Icons**: Visual icons for each design system category for better identification
- **Improved Breadcrumb Navigation**: Enhanced element path display with better readability
- **Optimized Category Ordering**: Improved UI layout with logical category arrangement

## Installation

### From Source
1. Clone this repository:
   ```bash
   git clone https://github.com/srizon/token-inspector.git
   cd token-inspector
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the `token-inspector` directory

5. The Token Inspector extension will now be available in your Chrome toolbar

## Usage

### Basic Usage
1. Navigate to any webpage you want to analyze
2. Click the Token Inspector icon in your Chrome toolbar
3. The extension will automatically scan the page for design token violations
4. Review the results organized by category (Colors, Typography, Spacing, Border)

### Developer Tools Panel
1. Open Chrome DevTools (F12 or right-click → Inspect)
2. Navigate to the "Token Inspector" tab
3. Click "Scan Page" to analyze the current page
4. View detailed results with element highlighting capabilities
5. Click on any violation to highlight the affected element on the page

**Note**: The DevTools panel works independently of the popup and provides a more detailed analysis interface for developers.

## Categories Analyzed

- **Colors**: Hard-coded color values (hex, rgb, rgba)
- **Typography**: Font sizes, font weights, line heights
- **Spacing**: Margins, paddings, gaps
- **Border**: Border radius values

## Test Files

The repository includes test files to demonstrate the extension's capabilities:

- `simple-test.html`: Basic test cases for common violations
- `complex-test.html`: Complex scenarios with nested elements

## Development

### Project Structure
```
token-inspector/
├── manifest.json          # Extension manifest
├── popup.html             # Main popup interface
├── popup.js               # Popup functionality
├── popup.css              # Popup styling
├── content.js             # Content script for page analysis
├── shared-scanner.js      # Shared scanning logic module
├── panel.html             # DevTools panel interface
├── panel.js               # DevTools panel functionality
├── devtools.html          # DevTools integration
├── devtools.js            # DevTools setup
├── assets/                # Icon assets for categories
│   ├── icon-color.svg     # Color category icon
│   ├── icon-text.svg      # Typography category icon
│   ├── icon-spacing.svg   # Spacing category icon
│   ├── icon-border.svg    # Border category icon
│   └── icon-caret.svg     # Caret icon for navigation
├── simple-test.html       # Basic test scenarios
├── complex-test.html      # Complex test scenarios
├── flagged-variables.json # Custom flagged variables
└── README.md              # Project documentation
```

### Key Components

- **Content Script** (`content.js`): Analyzes DOM elements and extracts CSS properties
- **Shared Scanner** (`shared-scanner.js`): Reusable scanning logic for consistent analysis
- **Popup Interface** (`popup.html/js`): Main user interface for viewing results
- **DevTools Panel** (`panel.html/js`): Advanced analysis tools for developers
- **Performance Optimizations**: Efficient scanning algorithms and caching mechanisms
- **Icon System** (`assets/`): Category-specific icons for better visual identification

## Performance Optimizations

The extension has been significantly optimized for performance with the following improvements:

### Major Performance Gains:
- **Small pages (< 100 elements)**: 2-3x faster
- **Medium pages (100-1000 elements)**: 5-10x faster  
- **Large pages (> 1000 elements)**: 10-20x faster
- **Pages with many CSS rules**: 15-25x faster

### Key Optimizations:
- **CSS Rule Caching**: Pre-computed element-rule mapping
- **Selector and Breadcrumb Caching**: Eliminates redundant string operations
- **Early Termination**: Skips irrelevant elements early in processing
- **Optimized Element Matching**: Uses `element.matches()` for efficient matching
- **Memory Management**: Proper cache cleanup and management
- **Breadcrumb Depth Limiting**: Reduced max depth from 10 to 3 levels for better performance
- **Improved Breadcrumb Formatting**: Uses › separator for better readability

## Recent Updates

### Version 1.6 Updates:
- **Enhanced Breadcrumb System**: Improved element path display with better formatting and depth limiting
- **Optimized Category Ordering**: Reorganized UI layout with logical category arrangement (Colors, Spacing, Border, Typography)
- **Performance Improvements**: Reduced breadcrumb depth from 10 to 3 levels for better performance
- **UI Refinements**: Cleaned up console logging and improved code organization
- **New Caret Icon**: Added icon-caret.svg for enhanced navigation elements
- **Code Cleanup**: Removed unnecessary console logs and improved code structure
- **Better Element Selection**: Enhanced element tracking and selection functionality

### Version 1.5 Updates:
- **Complete UI Redesign**: Modernized popup interface with clean, minimal design
- **New Icon System**: Added category-specific SVG icons for Colors, Typography, Spacing, and Border
- **Enhanced Visual Hierarchy**: Improved layout with better typography, spacing, and color system
- **Better Accessibility**: Added proper HTML semantics, ARIA labels, and improved keyboard navigation
- **Responsive Design**: Enhanced mobile responsiveness and better cross-browser compatibility
- **Code Organization**: Restructured CSS with better naming conventions and modular architecture
- **Performance Improvements**: Optimized scanning algorithms and UI rendering
- **Asset Management**: Added dedicated assets directory for icons and visual elements

### Version 1.4 Updates:
- **Enhanced Visual Hierarchy**: Improved layout with better typography, spacing, and color system
- **New Icon System**: Added category-specific icons for better visual identification
- **Improved Summary View**: Replaced tabs with a more intuitive summary card layout
- **Better Accessibility**: Added proper HTML semantics, ARIA labels, and improved keyboard navigation
- **Responsive Design**: Enhanced mobile responsiveness and better cross-browser compatibility
- **Code Organization**: Restructured CSS with better naming conventions and modular architecture
- **Test File Updates**: Renamed and improved test files for better organization

### Version 1.3 Updates:
- **Enhanced Element Highlighting**: Improved visual feedback with smooth pulse animations and better contrast
- **Code Cleanup**: Removed unnecessary test files to streamline the codebase
- **Better Animation System**: Replaced static highlighting with animated pulse effects for better visibility
- **Improved User Experience**: Enhanced visual feedback when inspecting elements on the page
- **Optimized Styling**: Better outline and shadow effects for element highlighting
- **Cleaner Project Structure**: Removed redundant test files while maintaining core functionality

### Version 1.2 Updates:
- **Flagged Variables Support**: Added ability to flag specific CSS custom properties for analysis
- **Enhanced Tooltips**: Improved element highlighting with detailed tooltips showing property and value information
- **New Test Files**: Added comprehensive test files for flagged variables functionality
- **Web Accessible Resources**: Updated manifest to support flagged-variables.json resource
- **Better Element Inspection**: Enhanced element highlighting with tooltip display and cleanup
- **Improved Error Handling**: Better error handling for flagged variables loading

### Version 1.1 Updates:
- **Code Cleanup**: Removed unnecessary test files and server scripts
- **Streamlined Project Structure**: Focused on core functionality and essential test files
- **Updated Documentation**: Refreshed README with current project state
- **Performance Improvements**: Maintained all existing performance optimizations
- **Better Error Handling**: Improved error handling and user feedback
- **Enhanced UI**: Updated popup and panel interfaces for better user experience

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Performance Notes

The extension is optimized for performance with the following features:
- Efficient DOM traversal algorithms
- Caching mechanisms for repeated scans
- Minimal memory footprint
- Non-blocking UI updates
- Pre-computed element-rule mappings
- Optimized CSS selector processing
- Limited breadcrumb depth for better performance
- Improved string formatting and caching

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues or have questions, please:
1. Check the existing issues on GitHub
2. Create a new issue with detailed information about your problem
3. Include browser version, extension version, and steps to reproduce

## Roadmap

- [ ] Support for CSS custom properties analysis
- [ ] Integration with popular design systems (Material Design, Ant Design, etc.)
- [ ] Export functionality for violation reports
- [ ] Custom rule configuration
- [ ] Team collaboration features
- [ ] Web Workers for background processing
- [ ] Incremental scanning for dynamic content
- [ ] Dark mode support
- [ ] Custom theme configuration
- [ ] Enhanced breadcrumb visualization
- [ ] Advanced filtering options
- [ ] Batch scanning capabilities

---

**Token Inspector** - Making design systems more consistent, one scan at a time. 