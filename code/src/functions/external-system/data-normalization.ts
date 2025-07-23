import { ExternalSyncUnit, NormalizedAttachment, NormalizedItem } from '@devrev/ts-adaas'

// turns a sentry project into an externalsyncunit for devrev import
export function normalizeSentryProject(project: any): ExternalSyncUnit {
  return {
    id: project.id,
    name: project.name,
    description: `platform: ${project.platform || 'unknown'} | status: ${project.status}`,
    item_count: 0,
    item_type: 'sentry_projects',
  }
}

// turns a sentry issue into a normalizeditem for devrev mapping
export function normalizeSentryIssue(issue: any): NormalizedItem {
  const orgSlug = issue._orgSlug || issue.organization?.slug || 'unknown'
  const createSentryUrl = (issueId: string) => `https://${orgSlug}.sentry.io/issues/${issueId}/`

  return {
    id: issue.id,
    created_date: normalizeTimestamp(issue.firstSeen),
    modified_date: normalizeTimestamp(issue.lastSeen),
    data: {
      title: issue.title || 'untitled error',
      culprit: issue.culprit || '',
      body: formatSentryIssueBody(issue),
      level: issue.level || 'error',
      status: issue.status,
      count: issue.count || 0,
      userCount: issue.userCount || 0,
      permalink: issue.permalink || createSentryUrl(issue.id),
      item_url_field: issue.permalink || createSentryUrl(issue.id),
      metadata: {
        type: issue.type,
        value: issue.metadata?.value,
        filename: issue.metadata?.filename,
        function: issue.metadata?.function,
      },
      assignedTo: issue.assignedTo?.email || null,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
      platform: issue.platform,
      project: {
        id: issue.project.id,
        name: issue.project.name,
        slug: issue.project.slug,
      },
    },
  }
}

// turns a sentry user/member into a normalizeditem for devrev users
export function normalizeSentryUser(member: any): NormalizedItem {
  return {
    id: member.id,
    created_date: normalizeTimestamp(member.dateCreated) || new Date().toISOString(),
    modified_date: normalizeTimestamp(member.dateCreated) || new Date().toISOString(),
    data: {
      email: member.email,
      name: member.user?.name || member.email.split('@')[0],
      role: member.role,
      flags: {
        has2fa: member.flags?.['sso:linked'] || false,
        ssoLinked: member.flags?.['sso:linked'] || false,
        isActive: !member.expired,
      },
      teams: member.teams || [],
      orgRole: member.orgRole,
    },
  }
}

// turns a sentry event (error occurrence) into a normalizeditem
export function normalizeSentryEvent(event: any): NormalizedItem {
  return {
    id: event.id || event.eventID,
    created_date: normalizeTimestamp(event.dateCreated),
    modified_date: normalizeTimestamp(event.dateCreated),
    data: {
      message: event.message,
      platform: event.platform,
      environment: event.environment,
      release: event.release,
      user: event.user ? {
        id: event.user.id,
        email: event.user.email,
        ip_address: event.user.ip_address,
      } : null,
      contexts: {
        browser: event.contexts?.browser,
        os: event.contexts?.os,
        device: event.contexts?.device,
      },
      tags: event.tags || [],
      issueId: event.groupID,
    },
  }
}

// turns a sentry attachment into a normalizedattachment (sentry rarely uses these)
export function normalizeSentryAttachment(attachment: any): NormalizedAttachment {
  return {
    id: attachment.id,
    url: attachment.url,
    file_name: attachment.name || 'attachment',
    author_id: attachment.uploadedBy,
    parent_id: attachment.issueId,
  }
}

// ensures timestamps are iso 8601 format
function normalizeTimestamp(timestamp: any): string {
  if (!timestamp) {
    return new Date().toISOString()
  }
  if (typeof timestamp === 'string' && timestamp.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return timestamp
  }
  try {
    return new Date(timestamp).toISOString()
  } catch {
    console.warn(`invalid timestamp: ${timestamp}, using current time`)
    return new Date().toISOString()
  }
}

// builds a markdown body for a sentry issue
function formatSentryIssueBody(issue: any): string {
  const parts: string[] = []
  if (issue.culprit) {
    parts.push(`**error location:** ${issue.culprit}`)
  }
  if (issue.metadata) {
    parts.push('\n**error details:**')
    if (issue.metadata.type) parts.push(`- type: ${issue.metadata.type}`)
    if (issue.metadata.value) parts.push(`- value: ${issue.metadata.value}`)
    if (issue.metadata.filename) parts.push(`- file: ${issue.metadata.filename}`)
    if (issue.metadata.function) parts.push(`- function: ${issue.metadata.function}`)
  }
  parts.push('\n**impact:**')
  parts.push(`- occurrences: ${issue.count || 0}`)
  parts.push(`- users affected: ${issue.userCount || 0}`)
  parts.push(`- first seen: ${issue.firstSeen}`)
  parts.push(`- last seen: ${issue.lastSeen}`)
  if (issue.platform) {
    parts.push(`\n**platform:** ${issue.platform}`)
  }
  parts.push(`\n**status:** ${issue.status}`)
  if (issue.annotations && issue.annotations.length > 0) {
    parts.push('\n**annotations:**')
    issue.annotations.forEach((annotation: string) => {
      parts.push(`- ${annotation}`)
    })
  }
  parts.push(`\n**[view in sentry](${issue.permalink})**`)
  return parts.join('\n')
}

// checks required fields before sending to devrev
export function validateNormalizedItem(item: NormalizedItem, type: string): boolean {
  if (!item.id) {
    console.error(`${type} missing required field: id`)
    return false
  }
  if (!item.data || typeof item.data !== 'object') {
    console.error(`${type} missing required field: data`)
    return false
  }
  const data = item.data as any
  switch (type) {
    case 'issue':
      if (!data.title) {
        console.error('issue missing required field: title')
        return false
      }
      break
    case 'user':
      if (!data.email && !data.name) {
        console.error('user missing required field: email or name')
        return false
      }
      break
  }
  return true
}

// removes nulls, truncates long strings, and escapes special chars
export function sanitizeNormalizedItem(item: NormalizedItem): NormalizedItem {
  const maxStringLength = 10000
  const sanitized = { ...item }
  sanitized.data = Object.entries(item.data).reduce((acc, [key, value]) => {
    if (value == null) {
      return acc
    }
    if (typeof value === 'string' && value.length > maxStringLength) {
      acc[key] = value.substring(0, maxStringLength) + '... [truncated]'
    } else {
      acc[key] = value
    }

    return acc
  }, {} as any)

  return sanitized
}