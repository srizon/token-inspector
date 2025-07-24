# Token Inspector

A powerful Chrome extension that helps developers and designers inspect and analyze design tokens and hard-coded CSS values on webpages. Token Inspector provides real-time scanning capabilities to identify design system violations and ensure consistent design implementation.

## Features

- **Real-time Token Analysis**: Scans webpages for hard-coded CSS values that should be using design tokens
- **Categorized Results**: Organizes findings by design system categories (Colors, Typography, Spacing, Radius)
- **Interactive UI**: Clean, modern interface with tabbed navigation and detailed violation information
- **Developer Tools Integration**: Dedicated panel in Chrome DevTools for advanced analysis
- **Performance Optimized**: Efficient scanning algorithms with minimal impact on page performance

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
4. Review the results organized by category (Colors, Typography, Spacing, Radius)

### Developer Tools Panel
1. Open Chrome DevTools (F12 or right-click → Inspect)
2. Navigate to the "Token Inspector" tab
3. Click "Scan Page" to analyze the current page
4. View detailed results with element highlighting capabilities

## Categories Analyzed

- **Colors**: Hard-coded color values (hex, rgb, rgba)
- **Typography**: Font sizes, font weights, line heights
- **Spacing**: Margins, paddings, gaps
- **Radius**: Border radius values

## Test Files

The repository includes several test files to demonstrate the extension's capabilities:

- `simple-test.html`: Basic test cases for common violations
- `complext-test.html`: Complex scenarios with nested elements
- `performance-test.html`: Performance testing with large DOM structures

## Development

### Project Structure
```
token-inspector/
├── manifest.json          # Extension manifest
├── popup.html             # Main popup interface
├── popup.js               # Popup functionality
├── popup.css              # Popup styling
├── content.js             # Content script for page analysis
├── panel.html             # DevTools panel interface
├── panel.js               # DevTools panel functionality
├── devtools.html          # DevTools integration
├── devtools.js            # DevTools setup
└── test files/            # Various test scenarios
```

### Key Components

- **Content Script** (`content.js`): Analyzes DOM elements and extracts CSS properties
- **Popup Interface** (`popup.html/js`): Main user interface for viewing results
- **DevTools Panel** (`panel.html/js`): Advanced analysis tools for developers
- **Performance Optimizations**: Efficient scanning algorithms and caching mechanisms

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

See `OPTIMIZATION_NOTES.md` for detailed performance considerations and implementation details.

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

---

**Token Inspector** - Making design systems more consistent, one scan at a time. 