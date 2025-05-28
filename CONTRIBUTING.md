# Contributing to Fortinet Virtual Lab

Thank you for your interest in contributing to the Fortinet Virtual Lab project! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with the following information:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Environment information (OS, Docker version, etc.)

### Suggesting Enhancements

Enhancement suggestions are welcome! Please create an issue with:

- A clear, descriptive title
- Detailed description of the proposed enhancement
- Any relevant examples or mockups

### Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
4. Run tests to ensure your changes don't break existing functionality
5. Commit your changes (`git commit -m 'Add some feature'`)
6. Push to the branch (`git push origin feature/your-feature-name`)
7. Open a Pull Request

### Pull Request Guidelines

- Follow the coding style of the project
- Update documentation as needed
- Add tests for new features
- Keep pull requests focused on a single feature or fix

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/kmransom56/fortinet-virtual-lab.git
cd fortinet-virtual-lab
```

2. Set up development environment:
```bash
# For the simulators
cd simulators/fortiswitch
npm install
npm run dev

# Similarly for other simulators and UI
```

3. Run tests:
```bash
npm test
```

## Project Structure

- `/simulators` - API simulators for network devices
- `/ui` - Web management interface
- `/configs` - Configuration templates
- `/scripts` - Utility scripts
- `/kubernetes` - Kubernetes deployment files
- `/docs` - Documentation

## Code Style Guidelines

- Use ESLint for JavaScript/TypeScript code
- Follow the Prettier configuration for code formatting
- Document functions and classes with JSDoc comments
- Use meaningful variable and function names

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT License.
