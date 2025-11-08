# Contributing to Amazon Product Feed Enrichment Tool

Thank you for your interest in improving this project! This guide will help you understand our development workflow and standards.

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "AA Api"
   ```

2. **Set up credentials**
   ```bash
   cp config.template.js config.js
   # Edit config.js with your PA-API credentials
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Test your changes**
   ```bash
   # Run with sample data
   node src/aa-csv-parser.js sample-data/aa-report-sample.csv
   ```

5. **Commit and push**
   ```bash
   git add .
   git commit -m "Add: descriptive commit message"
   git push origin feature/your-feature-name
   ```

## 📋 Development Guidelines

### Code Style

- **Use ES6+ syntax**: Arrow functions, destructuring, async/await
- **Name variables clearly**: `topAsins` not `ta`, `enrichedProducts` not `ep`
- **Add JSDoc comments** for all functions:
  ```javascript
  /**
   * Enriches ASINs with product data from PA-API
   * @param {string[]} asins - Array of Amazon ASINs
   * @param {Object} config - PA-API configuration
   * @returns {Promise<Object[]>} Enriched product data
   */
  async function enrichAsins(asins, config) {
    // ...
  }
  ```
- **Handle errors gracefully**: Use try/catch, log errors, continue processing
- **Avoid hardcoding**: Use config values, not magic numbers/strings

### File Organization

```
/AA Api/
├── src/               # Source code modules
├── docs/              # Documentation
├── sample-data/       # Sample/test data
├── tests/             # Test files (if/when added)
└── pipedream-workflow-template.js  # Main workflow
```

### Commit Message Format

Use conventional commits:

```
Type: Short description (max 50 chars)

Longer explanation if needed (wrap at 72 chars)

- Bullet points for details
- Reference issues: Fixes #123
```

**Types:**
- `Add:` New feature or file
- `Fix:` Bug fix
- `Update:` Modify existing feature
- `Refactor:` Code restructure (no behavior change)
- `Docs:` Documentation only
- `Test:` Add/modify tests
- `Chore:` Maintenance (dependencies, config)

**Examples:**
```
Add: PA-API batch request retries with exponential backoff

Fix: Handle missing price data in PA-API responses

Update: Increase default feed size to 150 ASINs

Docs: Add PA-API rate limit details to README
```

## 🧪 Testing

### Manual Testing

1. **Test with sample data:**
   ```bash
   # Place sample CSV in sample-data/
   node src/aa-csv-parser.js sample-data/test-report.csv
   ```

2. **Test PA-API integration:**
   ```javascript
   // Set useMockApi: true in config for testing without API calls
   const config = require('./config');
   config.dev.useMockApi = true;
   ```

3. **Test end-to-end:**
   - Upload AA CSV to trigger
   - Verify feed generation
   - Check Slack notification
   - Inspect output JSON

### Test Checklist

Before submitting a PR:
- [ ] Code runs without errors
- [ ] Tested with sample AA data
- [ ] Error handling works (invalid ASINs, API failures)
- [ ] Output JSON is valid
- [ ] Slack notifications format correctly
- [ ] No credentials in code or logs
- [ ] Updated documentation if needed

## 📝 Documentation

### When to Update Documentation

- **New features**: Update README.md and relevant docs/
- **Configuration changes**: Update config.template.js and .env.template
- **API changes**: Update docs/PA_API_GUIDE.md
- **Bug fixes**: Update docs/TROUBLESHOOTING.md if user-facing

### Documentation Standards

- Use clear, concise language
- Include code examples
- Add screenshots for UI/visual changes
- Update TOC if adding new sections
- Test all command examples

## 🐛 Bug Reports

### How to Report

1. **Check existing issues** - Someone may have reported it already
2. **Create a detailed issue** with:
   - Clear title: "PA-API returns 401 error after token refresh"
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages/logs
   - Environment (Node version, Pipedream, etc.)
   - Sample data (redact credentials!)

### Bug Report Template

```markdown
**Description**
Brief description of the bug

**Steps to Reproduce**
1. Step one
2. Step two
3. ...

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Error Messages**
```
Paste error logs here
```

**Environment**
- Runtime: Node.js 18 / Pipedream
- Date: 2025-11-07
- Config: Default settings

**Additional Context**
Any other relevant information
```

## ✨ Feature Requests

### How to Propose Features

1. **Check roadmap** in docs/PRD.md - Future Enhancements section
2. **Open a feature request issue** with:
   - Clear use case: "As a publisher, I want to..."
   - Business value: Why is this important?
   - Proposed solution: How might it work?
   - Alternatives considered

### Feature Request Template

```markdown
**Feature Description**
Clear, one-sentence description

**Use Case**
Who needs this and why?

**Proposed Solution**
How should it work?

**Alternatives Considered**
Other ways to solve this

**Additional Context**
Mockups, examples, related features
```

## 🔐 Security

### Never Commit:
- PA-API credentials
- Slack webhook URLs
- Real AA data with sensitive info
- Private publisher information

### If You Accidentally Commit Secrets:
1. **Immediately rotate credentials** (generate new PA-API keys)
2. **Remove from Git history**: Use `git filter-branch` or BFG Repo Cleaner
3. **Notify team lead**

## 📦 Release Process

### Version Numbering

We use Semantic Versioning (semver):
- **Major (1.0.0)**: Breaking changes
- **Minor (0.1.0)**: New features (backward compatible)
- **Patch (0.0.1)**: Bug fixes

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json (if applicable)
- [ ] Tagged release in Git
- [ ] Pipedream workflow updated
- [ ] Team notified

## 💡 Code Review Guidelines

### As a Reviewer:
- Be constructive and kind
- Ask questions rather than make demands
- Suggest alternatives if you see issues
- Approve if minor changes needed (comment only)

### As an Author:
- Respond to all comments
- Push changes in response to feedback
- Ask for clarification if confused
- Don't take feedback personally

## 🤝 Getting Help

- **Questions?** Open a discussion issue
- **Stuck?** Check docs/TROUBLESHOOTING.md
- **Need clarity?** Tag a team member in your PR

## 📜 License

By contributing, you agree that your contributions will be licensed under the same terms as the main project (internal use).

---

**Thank you for contributing!** 🎉

Your improvements help us build better, more reliable product feeds for our publishers.

