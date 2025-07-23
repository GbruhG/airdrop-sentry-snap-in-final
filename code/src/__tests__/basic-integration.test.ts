describe('Basic Integration Tests', () => {
  it('should have function factory configured', () => {
    const { functionFactory } = require('../function-factory');
    
    expect(functionFactory).toBeDefined();
    expect(typeof functionFactory.extraction).toBe('function');
    expect(typeof functionFactory.loading).toBe('function');
  });

  it('should have domain metadata configured', () => {
    const domainMetadata = require('../functions/external-system/external_domain_metadata.json');
    
    expect(domainMetadata.schema_version).toBe('v0.2.0');
    expect(domainMetadata.record_types).toBeDefined();
    expect(domainMetadata.record_types.sentry_issues).toBeDefined();
    expect(domainMetadata.record_types.sentry_users).toBeDefined();
  });

  it('should have proper issue field configuration', () => {
    const domainMetadata = require('../functions/external-system/external_domain_metadata.json');
    const issuesFields = domainMetadata.record_types.sentry_issues.fields;
    
    expect(issuesFields.id.is_required).toBe(true);
    expect(issuesFields.title.is_required).toBe(true);
    expect(issuesFields.firstSeen.is_required).toBe(true);
    expect(issuesFields.lastSeen.is_required).toBe(true);
  });

  it('should have proper user field configuration', () => {
    const domainMetadata = require('../functions/external-system/external_domain_metadata.json');
    const usersFields = domainMetadata.record_types.sentry_users.fields;
    
    expect(usersFields.id.is_required).toBe(true);
    expect(usersFields.email.is_required).toBe(true);
  });
});