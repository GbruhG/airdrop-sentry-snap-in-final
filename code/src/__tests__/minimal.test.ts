describe('Minimal Tests', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have required configuration files', () => {
    const domainMetadata = require('../functions/external-system/external_domain_metadata.json');
    expect(domainMetadata).toBeDefined();
    expect(domainMetadata.schema_version).toBe('v0.2.0');
  });

  it('should have function factory', () => {
    const { functionFactory } = require('../function-factory');
    expect(functionFactory).toBeDefined();
    expect(functionFactory.extraction).toBeDefined();
    expect(functionFactory.loading).toBeDefined();
  });

  it('should normalize simple data', () => {
    const { normalizeSentryIssue } = require('../functions/external-system/data-normalization');
    
    const issue = {
      id: '123',
      title: 'Test',
      firstSeen: '2024-01-01T00:00:00Z',
      lastSeen: '2024-01-01T00:00:00Z',
      project: {
        id: 'proj-1',
        name: 'Test Project',
        slug: 'test-project',
      },
    };

    const normalized = normalizeSentryIssue(issue);
    expect(normalized.id).toBe('123');
  });
});