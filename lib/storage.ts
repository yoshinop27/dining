import type { Group } from './types'

const GROUPS_KEY = 'dining_groups'

export function getSavedGroups(): Group[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveGroup(group: Group): void {
  const groups = getSavedGroups()
  const idx = groups.findIndex(g => g.id === group.id)
  if (idx >= 0) groups[idx] = group
  else groups.push(group)
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
}

export function deleteGroup(id: string): void {
  const groups = getSavedGroups().filter(g => g.id !== id)
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
}
