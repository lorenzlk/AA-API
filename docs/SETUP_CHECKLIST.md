# Setup Checklist

Complete deployment checklist for the Amazon Product Feed Enrichment Tool.

## Pre-Deployment

### 1. Amazon Product Advertising API Setup
- [ ] Sign up for Amazon Associates account
- [ ] Request PA-API access at https://affiliate-program.amazon.com/assoc_credentials/home
- [ ] Note your Access Key, Secret Key, and Associate Tag
- [ ] Verify PA-API access is approved (can take 24-48 hours)
- [ ] Test credentials with a sample request

### 2. Pipedream Account Setup
- [ ] Create free Pipedream account at https://pipedream.com
- [ ] Familiarize yourself with the Pipedream UI
- [ ] Understand environment variables/secrets

### 3. Slack Setup
- [ ] Choose Slack channel for notifications
- [ ] Create webhook at https://api.slack.com/messaging/webhooks
- [ ] Test webhook with curl or Postman
- [ ] Save webhook URL securely

### 4. Google Drive Setup (Optional)
- [ ] Create folder for AA CSV uploads
- [ ] Note the folder ID
- [ ] Grant Pipedream access to Google Drive
- [ ] Test file upload detection

## Deployment

### Step 1: Repository Setup
- [ ] Clone repository: `git clone https://github.com/lorenzlk/AA-API.git`
- [ ] Review README.md and documentation
- [ ] Copy config.template.js to config.js
- [ ] Fill in your credentials in config.js (for local testing)
- [ ] Never commit config.js (verify .gitignore)

### Step 2: Local Testing (Optional)
- [ ] Install dependencies: `npm install`
- [ ] Test CSV parser with sample data
- [ ] Test ASIN aggregator
- [ ] Test PA-API client with your credentials
- [ ] Verify all modules work independently

### Step 3: Pipedream Workflow Deployment
- [ ] Log into Pipedream
- [ ] Create new workflow
- [ ] Import `pipedream-workflow-template.js` code
- [ ] Configure environment variables:
  - [ ] `PA_API_ACCESS_KEY`
  - [ ] `PA_API_SECRET_KEY`
  - [ ] `PA_API_ASSOCIATE_TAG`
  - [ ] `PA_API_REGION` (default: us-east-1)
  - [ ] `SLACK_WEBHOOK_URL`
  - [ ] `FEED_TOP_N` (default: 100)
  - [ ] `FEED_RANKING_METRIC` (default: ordered_items)
  - [ ] `PUBLISHER_NAME` (default: mula)

### Step 4: Trigger Configuration
- [ ] Choose trigger type (Google Drive OR HTTP Webhook)
- [ ] If Google Drive:
  - [ ] Add Google Drive trigger step
  - [ ] Select "New File in Folder"
  - [ ] Choose AA Reports folder
  - [ ] Set file pattern: `*.csv`
- [ ] If HTTP Webhook:
  - [ ] Use default HTTP trigger
  - [ ] Note the webhook URL
  - [ ] Plan how to send CSV data

### Step 5: Testing
- [ ] Upload test AA CSV to Google Drive (or send to webhook)
- [ ] Monitor Pipedream execution logs
- [ ] Verify each step completes successfully
- [ ] Check Slack for notification
- [ ] Verify feed JSON is generated correctly
- [ ] Test with invalid data to verify error handling

### Step 6: Validation
- [ ] Check enrichment success rate (target: 95%+)
- [ ] Verify processing time (<60 seconds for 100 ASINs)
- [ ] Confirm feed format matches specification
- [ ] Test affiliate links work correctly
- [ ] Validate metadata file accuracy

## Post-Deployment

### Monitoring Setup
- [ ] Set up daily check of Pipedream execution logs
- [ ] Create alert for failed executions
- [ ] Monitor Slack channel for notifications
- [ ] Track enrichment success rates
- [ ] Review feed quality weekly

### Documentation
- [ ] Document your specific setup (folders, credentials)
- [ ] Create runbook for common issues
- [ ] Train team members on system
- [ ] Document any customizations made

### Maintenance Schedule
- [ ] Weekly: Review execution logs
- [ ] Weekly: Check enrichment rates
- [ ] Monthly: Validate PA-API credentials
- [ ] Monthly: Review feed performance metrics
- [ ] Quarterly: Update dependencies
- [ ] Quarterly: Review and optimize

## Troubleshooting Checklist

If something goes wrong, check:

- [ ] PA-API credentials are correct and active
- [ ] Slack webhook URL is valid
- [ ] Google Drive trigger is configured correctly
- [ ] CSV file format matches expectations
- [ ] Pipedream has sufficient credits
- [ ] Environment variables are set correctly
- [ ] Check Pipedream execution logs for errors
- [ ] Review [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

## Success Criteria

You're ready for production when:

- [ ] ✅ Test CSV parses successfully
- [ ] ✅ ASINs aggregate and rank correctly
- [ ] ✅ PA-API enrichment succeeds (95%+)
- [ ] ✅ Feed JSON generates correctly
- [ ] ✅ Slack notification received
- [ ] ✅ Affiliate links work
- [ ] ✅ Error handling tested
- [ ] ✅ Team trained on system
- [ ] ✅ Documentation complete
- [ ] ✅ Monitoring in place

## Next Steps After Launch

1. **Week 1:** Monitor daily, fix any issues immediately
2. **Week 2-4:** Validate feed quality, compare to keyword-based feeds
3. **Month 2:** Measure CTR improvement vs baseline
4. **Month 3:** Consider phase 2 enhancements

## Support Resources

- **Quick Start:** [../QUICKSTART.md](../QUICKSTART.md)
- **Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **PA-API Guide:** [PA_API_GUIDE.md](./PA_API_GUIDE.md)
- **GitHub Issues:** https://github.com/lorenzlk/AA-API/issues

---

**Deployment Date:** _____________  
**Deployed By:** _____________  
**Verified By:** _____________  
**Status:** [ ] Staging [ ] Production

