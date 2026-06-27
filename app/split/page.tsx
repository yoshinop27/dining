'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSavedGroups, saveGroup } from '@/lib/storage'
import type { Receipt, ReceiptItem, Person, Group } from '@/lib/types'

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function formatMoney(n: number) {
  return '$' + n.toFixed(2)
}

function calcPersonTotals(items: ReceiptItem[], people: Person[], tax: number, tip: number) {
  const assignedSubtotal = items.reduce((sum, item) => {
    return item.assignedTo.length > 0 ? sum + item.price : sum
  }, 0)

  return people.map(person => {
    const itemShare = items.reduce((sum, item) => {
      if (item.assignedTo.includes(person.id)) {
        return sum + item.price / item.assignedTo.length
      }
      return sum
    }, 0)
    const fraction = assignedSubtotal > 0 ? itemShare / assignedSubtotal : 0
    return {
      person,
      itemShare,
      total: itemShare + fraction * (tax + tip),
    }
  })
}

// ── Assign sheet ──────────────────────────────────────────────────────────────

function AssignSheet({
  item,
  people,
  onDone,
  onClose,
}: {
  item: ReceiptItem
  people: Person[]
  onDone: (assignedTo: string[]) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string[]>(item.assignedTo)

  const toggle = (id: string) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const allSelected = people.length > 0 && selected.length === people.length
  const toggleAll = () => setSelected(allSelected ? [] : people.map(p => p.id))

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-3xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Assign item</p>
              <p className="font-semibold text-gray-900 mt-0.5">{item.name}</p>
            </div>
            <p className="font-semibold text-gray-900">{formatMoney(item.price)}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {people.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Add people first</p>
          ) : (
            <>
              <button
                className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-50 active:bg-gray-50"
                onClick={toggleAll}
              >
                <span className="text-sm font-medium text-gray-700">
                  {allSelected ? 'Deselect all' : 'Select all (split evenly)'}
                </span>
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    allSelected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                  }`}
                >
                  {allSelected && <span className="text-white text-xs">✓</span>}
                </div>
              </button>
              {people.map(person => {
                const on = selected.includes(person.id)
                return (
                  <button
                    key={person.id}
                    className="w-full px-5 py-4 flex items-center gap-3 border-b border-gray-50 active:bg-gray-50"
                    onClick={() => toggle(person.id)}
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm flex-shrink-0">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-gray-900">{person.name}</p>
                      {person.phone && <p className="text-xs text-gray-400">{person.phone}</p>}
                    </div>
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        on ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                      }`}
                    >
                      {on && <span className="text-white text-xs">✓</span>}
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => onDone(selected)}
            className="w-full bg-emerald-600 text-white rounded-2xl py-4 font-semibold text-base active:bg-emerald-700"
          >
            Done {selected.length > 0 && `· Split ${selected.length} way${selected.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Person modal ──────────────────────────────────────────────────────────

function AddPersonModal({
  onAdd,
  onClose,
}: {
  onAdd: (person: Person) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ id: uid(), name: trimmed, phone: phone.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-3xl p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h3 className="font-semibold text-gray-900 mb-4">Add Person</h3>
        <div className="space-y-3 mb-5">
          <input
            ref={nameRef}
            type="text"
            placeholder="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400"
          />
          <input
            type="tel"
            placeholder="Phone number (optional)"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400"
          />
        </div>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="w-full bg-emerald-600 text-white rounded-2xl py-4 font-semibold disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ── Save Group modal ──────────────────────────────────────────────────────────

function SaveGroupModal({
  people,
  onSave,
  onClose,
}: {
  people: Person[]
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-3xl p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h3 className="font-semibold text-gray-900 mb-1">Save Group</h3>
        <p className="text-sm text-gray-400 mb-4">{people.map(p => p.name).join(', ')}</p>
        <input
          type="text"
          placeholder="Group name (e.g. Work Crew)"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim())}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-400 mb-4"
        />
        <button
          onClick={() => name.trim() && onSave(name.trim())}
          disabled={!name.trim()}
          className="w-full bg-emerald-600 text-white rounded-2xl py-4 font-semibold disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ── Load group modal ──────────────────────────────────────────────────────────

function LoadGroupModal({
  onLoad,
  onClose,
}: {
  onLoad: (group: Group) => void
  onClose: () => void
}) {
  const groups = getSavedGroups()

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-3xl max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900">Load a Group</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No saved groups yet</p>
          ) : (
            groups.map(group => (
              <button
                key={group.id}
                className="w-full px-5 py-4 flex flex-col text-left border-b border-gray-50 active:bg-gray-50"
                onClick={() => onLoad(group)}
              >
                <span className="font-medium text-gray-900 text-sm">{group.name}</span>
                <span className="text-xs text-gray-400 mt-0.5">
                  {group.people.map(p => p.name).join(', ')}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main split page ───────────────────────────────────────────────────────────

type Tab = 'items' | 'summary'
type Modal = 'addPerson' | 'saveGroup' | 'loadGroup' | null

export default function SplitPage() {
  const router = useRouter()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [items, setItems] = useState<ReceiptItem[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [tip, setTip] = useState(0)
  const [editingTip, setEditingTip] = useState(false)
  const [tipInput, setTipInput] = useState('')
  const [tab, setTab] = useState<Tab>('items')
  const [modal, setModal] = useState<Modal>(null)
  const [assigningItem, setAssigningItem] = useState<ReceiptItem | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('receipt')
    if (!raw) { router.replace('/'); return }
    const r: Receipt = JSON.parse(raw)
    setReceipt(r)
    setItems(r.items)
    setTip(r.tip)

    const groupId = sessionStorage.getItem('preloadGroupId')
    if (groupId) {
      const groups = getSavedGroups()
      const g = groups.find(g => g.id === groupId)
      if (g) setPeople(g.people)
    }
  }, [router])

  if (!receipt) return null

  const tax = receipt.tax
  const totals = calcPersonTotals(items, people, tax, tip)
  const unassignedItems = items.filter(i => i.assignedTo.length === 0)

  const assignItem = (itemId: string, assignedTo: string[]) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, assignedTo } : i))
    setAssigningItem(null)
  }

  const addPerson = (person: Person) => setPeople(prev => [...prev, person])

  const removePerson = (id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id))
    setItems(prev =>
      prev.map(item => ({
        ...item,
        assignedTo: item.assignedTo.filter(pid => pid !== id),
      }))
    )
  }

  const handleSaveGroup = (name: string) => {
    saveGroup({ id: uid(), name, people })
    setModal(null)
  }

  const handleLoadGroup = (group: Group) => {
    setPeople(group.people)
    setItems(prev =>
      prev.map(item => ({
        ...item,
        assignedTo: item.assignedTo.filter(id => group.people.some(p => p.id === id)),
      }))
    )
    setModal(null)
  }

  const commitTip = () => {
    const val = parseFloat(tipInput)
    if (!isNaN(val) && val >= 0) setTip(val)
    setEditingTip(false)
  }

  const grandTotal = totals.reduce((s, t) => s + t.total, 0)
  const receiptTotal = receipt.subtotal + tax + tip

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col pb-20">
      {/* Header */}
      <div className="bg-emerald-600 px-5 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.replace('/')} className="text-emerald-200 text-sm">
            ← Back
          </button>
        </div>
        <h1 className="text-xl font-bold text-white truncate">
          {receipt.restaurantName ?? 'Receipt'}
        </h1>

        {/* Receipt totals row */}
        <div className="mt-3 flex gap-3 text-sm">
          <div className="flex-1 bg-emerald-700/50 rounded-xl px-3 py-2">
            <p className="text-emerald-200 text-xs">Subtotal</p>
            <p className="text-white font-semibold">{formatMoney(receipt.subtotal)}</p>
          </div>
          <div className="flex-1 bg-emerald-700/50 rounded-xl px-3 py-2">
            <p className="text-emerald-200 text-xs">Tax</p>
            <p className="text-white font-semibold">{formatMoney(tax)}</p>
          </div>
          <button
            className="flex-1 bg-emerald-700/50 rounded-xl px-3 py-2 text-left"
            onClick={() => { setTipInput(tip.toFixed(2)); setEditingTip(true) }}
          >
            <p className="text-emerald-200 text-xs">Tip ✏️</p>
            <p className="text-white font-semibold">{formatMoney(tip)}</p>
          </button>
          <div className="flex-1 bg-white/20 rounded-xl px-3 py-2">
            <p className="text-emerald-100 text-xs">Total</p>
            <p className="text-white font-bold">{formatMoney(receiptTotal)}</p>
          </div>
        </div>
      </div>

      {/* People strip */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setModal('addPerson')}
            className="flex-shrink-0 w-9 h-9 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xl leading-none"
          >
            +
          </button>
          {people.map(person => (
            <div
              key={person.id}
              className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full pl-1.5 pr-2.5 py-1"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                {person.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-emerald-800 font-medium">{person.name}</span>
              <button
                onClick={() => removePerson(person.id)}
                className="text-emerald-400 text-xs ml-0.5"
              >
                ×
              </button>
            </div>
          ))}
          {people.length >= 2 && (
            <button
              onClick={() => setModal('saveGroup')}
              className="flex-shrink-0 text-xs text-gray-400 px-2 py-1 border border-dashed border-gray-200 rounded-full whitespace-nowrap"
            >
              Save group
            </button>
          )}
          {getSavedGroups().length > 0 && (
            <button
              onClick={() => setModal('loadGroup')}
              className="flex-shrink-0 text-xs text-gray-400 px-2 py-1 border border-dashed border-gray-200 rounded-full whitespace-nowrap"
            >
              Load group
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 flex">
        {(['items', 'summary'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
              tab === t
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-400'
            }`}
          >
            {t}
            {t === 'items' && unassignedItems.length > 0 && (
              <span className="ml-1.5 bg-orange-100 text-orange-600 text-xs rounded-full px-1.5 py-0.5">
                {unassignedItems.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'items' ? (
        <div className="flex-1 p-4 space-y-2">
          {people.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              Add people above, then tap items to assign them.
            </div>
          )}
          {items.map(item => {
            const assignedPeople = people.filter(p => item.assignedTo.includes(p.id))
            const unassigned = item.assignedTo.length === 0

            return (
              <button
                key={item.id}
                onClick={() => setAssigningItem(item)}
                className={`w-full bg-white rounded-xl border shadow-sm px-4 py-3 flex items-start gap-3 text-left active:scale-[0.99] transition-transform ${
                  unassigned ? 'border-orange-200' : 'border-gray-100'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  {assignedPeople.length > 0 && (
                    <p className="text-xs text-emerald-600 mt-1">
                      {assignedPeople.map(p => p.name).join(', ')}
                      {assignedPeople.length > 1 && ` · ${formatMoney(item.price / assignedPeople.length)} each`}
                    </p>
                  )}
                  {unassigned && people.length > 0 && (
                    <p className="text-xs text-orange-400 mt-1">Tap to assign</p>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                  {formatMoney(item.price)}
                </p>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex-1 p-4 space-y-3">
          {people.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              Add people to see the breakdown
            </p>
          ) : (
            <>
              {totals.map(({ person, itemShare, total }) => (
                <div key={person.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold">
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{person.name}</p>
                        {person.phone && (
                          <p className="text-xs text-gray-400">{person.phone}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xl font-bold text-emerald-600">{formatMoney(total)}</p>
                  </div>
                  <div className="text-xs text-gray-400 space-y-0.5 pt-2 border-t border-gray-50">
                    <div className="flex justify-between">
                      <span>Items</span>
                      <span>{formatMoney(itemShare)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax + tip share</span>
                      <span>{formatMoney(total - itemShare)}</span>
                    </div>
                  </div>
                  {/* Items assigned */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {items
                      .filter(i => i.assignedTo.includes(person.id))
                      .map(i => (
                        <span
                          key={i.id}
                          className="text-xs bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 text-gray-500 truncate max-w-[140px]"
                        >
                          {i.name}
                        </span>
                      ))}
                  </div>
                </div>
              ))}

              {unassignedItems.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
                  {unassignedItems.length} item{unassignedItems.length > 1 ? 's' : ''} not yet assigned
                </div>
              )}

              <div className="bg-gray-100 rounded-xl px-4 py-3 flex justify-between text-sm font-semibold text-gray-700">
                <span>Total split</span>
                <span>{formatMoney(grandTotal)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tip editing overlay */}
      {editingTip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40" onClick={() => setEditingTip(false)}>
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-xs"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-gray-900 mb-3">Edit Tip</h3>
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={tipInput}
                onChange={e => setTipInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && commitTip()}
                autoFocus
                className="w-full border border-gray-200 rounded-xl pl-7 pr-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>
            <button
              onClick={commitTip}
              className="w-full bg-emerald-600 text-white rounded-xl py-3 font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal === 'addPerson' && (
        <AddPersonModal onAdd={addPerson} onClose={() => setModal(null)} />
      )}
      {modal === 'saveGroup' && (
        <SaveGroupModal people={people} onSave={handleSaveGroup} onClose={() => setModal(null)} />
      )}
      {modal === 'loadGroup' && (
        <LoadGroupModal onLoad={handleLoadGroup} onClose={() => setModal(null)} />
      )}
      {assigningItem && (
        <AssignSheet
          item={assigningItem}
          people={people}
          onDone={assigned => assignItem(assigningItem.id, assigned)}
          onClose={() => setAssigningItem(null)}
        />
      )}
    </div>
  )
}
