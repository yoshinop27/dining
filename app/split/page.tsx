'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSavedGroups, saveGroup } from '@/lib/storage'
import type { Receipt, ReceiptItem, Person, Group } from '@/lib/types'

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function fmt(n: number) {
  return '$' + n.toFixed(2)
}

function calcPersonTotals(
  items: ReceiptItem[],
  people: Person[],
  tax: number,
  tip: number,
  tipPercent: number,
) {
  const assignedSubtotal = items.reduce(
    (sum, item) => (item.assignedTo.length > 0 ? sum + item.price : sum),
    0,
  )

  return people.map(person => {
    const itemShare = items.reduce((sum, item) => {
      if (item.assignedTo.includes(person.id)) return sum + item.price / item.assignedTo.length
      return sum
    }, 0)
    const fraction = assignedSubtotal > 0 ? itemShare / assignedSubtotal : 0
    const taxShare = fraction * tax
    const tipShare = fraction * tip
    return { person, itemShare, taxShare, tipShare, tipPercent, total: itemShare + taxShare + tipShare }
  })
}

function buildSmsBody(
  person: Person,
  assignedItems: { name: string; price: number; splits: number }[],
  taxShare: number,
  tipShare: number,
  tipPercent: number,
  total: number,
  restaurant: string | null,
) {
  const lines = [
    `Hi ${person.name}! Here's your share of the bill${restaurant ? ` at ${restaurant}` : ''}:`,
    '',
    ...assignedItems.map(
      i => `${i.name}${i.splits > 1 ? ` (1/${i.splits})` : ''}: ${fmt(i.price)}`,
    ),
    '',
    `Tax: ${fmt(taxShare)}`,
    `Tip (${tipPercent}%): ${fmt(tipShare)}`,
    `Total: ${fmt(total)}`,
  ]
  return lines.join('\n')
}

// ── Assign sheet ──────────────────────────────────────────────────────────────

function AssignSheet({
  itemCount,
  initialAssigned,
  people,
  onDone,
  onClose,
}: {
  itemCount: number
  initialAssigned: string[]
  people: Person[]
  onDone: (assignedTo: string[]) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string[]>(initialAssigned)

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
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Assign</p>
          <p className="font-semibold text-gray-900 mt-0.5">
            {itemCount === 1 ? '1 item' : `${itemCount} items`}
          </p>
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
                  {allSelected ? 'Deselect all' : 'Split evenly between everyone'}
                </span>
                <Checkbox checked={allSelected} />
              </button>
              {people.map(person => {
                const on = selected.includes(person.id)
                return (
                  <button
                    key={person.id}
                    className="w-full px-5 py-4 flex items-center gap-3 border-b border-gray-50 active:bg-gray-50"
                    onClick={() => toggle(person.id)}
                  >
                    <Avatar name={person.name} />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-gray-900">{person.name}</p>
                      {person.phone && <p className="text-xs text-gray-400">{person.phone}</p>}
                    </div>
                    <Checkbox checked={on} />
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
            Done
            {selected.length > 1 && ` · split ${selected.length} ways`}
            {selected.length === 1 && ` · 1 person`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Reusable small components ─────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm flex-shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
        checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
      }`}
    >
      {checked && <span className="text-white text-xs leading-none">✓</span>}
    </div>
  )
}

// ── Add Person modal ──────────────────────────────────────────────────────────

function AddPersonModal({ onAdd, onClose }: { onAdd: (p: Person) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ id: uid(), name: trimmed, phone: phone.trim() })
    onClose()
  }

  return (
    <BottomSheet onClose={onClose} title="Add Person">
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
    </BottomSheet>
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
    <BottomSheet onClose={onClose} title="Save Group">
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
    </BottomSheet>
  )
}

// ── Load Group modal ──────────────────────────────────────────────────────────

function LoadGroupModal({ onLoad, onClose }: { onLoad: (g: Group) => void; onClose: () => void }) {
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

// ── Shared bottom sheet wrapper ───────────────────────────────────────────────

function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-3xl p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}

// ── Person summary card ───────────────────────────────────────────────────────

function PersonCard({
  person,
  itemShare,
  taxShare,
  tipShare,
  tipPercent,
  total,
  items,
  restaurantName,
}: {
  person: Person
  itemShare: number
  taxShare: number
  tipShare: number
  tipPercent: number
  total: number
  items: ReceiptItem[]
  restaurantName: string | null
}) {
  const assignedItems = items
    .filter(i => i.assignedTo.includes(person.id))
    .map(i => ({
      name: i.name,
      price: i.price / i.assignedTo.length,
      splits: i.assignedTo.length,
    }))

  const smsBody = buildSmsBody(
    person,
    assignedItems,
    taxShare,
    tipShare,
    tipPercent,
    total,
    restaurantName,
  )
  const smsLink = person.phone
    ? `sms:${person.phone}?body=${encodeURIComponent(smsBody)}`
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Person header */}
      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold">
            {person.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{person.name}</p>
            {person.phone && <p className="text-xs text-gray-400">{person.phone}</p>}
          </div>
        </div>
        {smsLink ? (
          <a
            href={smsLink}
            className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full"
          >
            Send Text
          </a>
        ) : (
          <span className="text-xs text-gray-300">No phone #</span>
        )}
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <tbody>
          {assignedItems.map((item, i) => (
            <tr key={i} className="border-t border-gray-50">
              <td className="px-4 py-2 text-gray-700">
                {item.name}
                {item.splits > 1 && (
                  <span className="text-gray-400 text-xs ml-1.5">(1/{item.splits})</span>
                )}
              </td>
              <td className="px-4 py-2 text-right text-gray-900 font-medium whitespace-nowrap">
                {fmt(item.price)}
              </td>
            </tr>
          ))}
          {assignedItems.length === 0 && (
            <tr>
              <td colSpan={2} className="px-4 py-3 text-gray-400 text-xs text-center border-t border-gray-50">
                No items assigned
              </td>
            </tr>
          )}
          <tr className="border-t border-gray-100 bg-gray-50/60">
            <td className="px-4 py-2 text-gray-400 text-xs">Tax</td>
            <td className="px-4 py-2 text-right text-gray-400 text-xs">{fmt(taxShare)}</td>
          </tr>
          <tr className="border-t border-gray-50 bg-gray-50/60">
            <td className="px-4 py-2 text-gray-400 text-xs">Tip ({tipPercent}%)</td>
            <td className="px-4 py-2 text-right text-gray-400 text-xs">{fmt(tipShare)}</td>
          </tr>
          <tr className="border-t-2 border-gray-200">
            <td className="px-4 py-3 font-bold text-gray-900">Total</td>
            <td className="px-4 py-3 text-right font-bold text-emerald-600 text-base">
              {fmt(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'items' | 'summary'
type Modal = 'addPerson' | 'saveGroup' | 'loadGroup' | null

export default function SplitPage() {
  const router = useRouter()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [items, setItems] = useState<ReceiptItem[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [tipPercent, setTipPercent] = useState(18)
  const [tab, setTab] = useState<Tab>('items')
  const [modal, setModal] = useState<Modal>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('receipt')
    if (!raw) { router.replace('/'); return }
    const r: Receipt = JSON.parse(raw)
    setReceipt(r)
    setItems(r.items)

    const groupId = sessionStorage.getItem('preloadGroupId')
    if (groupId) {
      const g = getSavedGroups().find(g => g.id === groupId)
      if (g) setPeople(g.people)
    }
  }, [router])

  if (!receipt) return null

  const tax = receipt.tax
  const tip = Math.round(receipt.subtotal * tipPercent) / 100
  const totals = calcPersonTotals(items, people, tax, tip, tipPercent)
  const unassignedCount = items.filter(i => i.assignedTo.length === 0).length

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const applyAssignment = (assignedTo: string[]) => {
    setItems(prev =>
      prev.map(item =>
        selectedIds.includes(item.id) ? { ...item, assignedTo } : item,
      ),
    )
    setSelectedIds([])
    setAssigning(false)
  }

  const removePerson = (id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id))
    setItems(prev =>
      prev.map(item => ({ ...item, assignedTo: item.assignedTo.filter(pid => pid !== id) })),
    )
  }

  const handleLoadGroup = (group: Group) => {
    setPeople(group.people)
    setItems(prev =>
      prev.map(item => ({
        ...item,
        assignedTo: item.assignedTo.filter(id => group.people.some(p => p.id === id)),
      })),
    )
    setModal(null)
  }

  const grandTotal = totals.reduce((s, t) => s + t.total, 0)

  // For the assign sheet initial state: common assigned people across all selected items
  const selectedItems = items.filter(i => selectedIds.includes(i.id))
  const commonAssigned =
    selectedItems.length === 1
      ? selectedItems[0].assignedTo
      : []

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col pb-24">
      {/* Header */}
      <div className="bg-emerald-600 px-5 pt-12 pb-4">
        <button onClick={() => router.replace('/')} className="text-emerald-200 text-sm mb-3 block">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-white truncate">
          {receipt.restaurantName ?? 'Receipt'}
        </h1>

        <div className="mt-3 flex gap-2 text-sm">
          <div className="flex-1 bg-emerald-700/50 rounded-xl px-3 py-2">
            <p className="text-emerald-200 text-xs">Subtotal</p>
            <p className="text-white font-semibold">{fmt(receipt.subtotal)}</p>
          </div>
          <div className="flex-1 bg-emerald-700/50 rounded-xl px-3 py-2">
            <p className="text-emerald-200 text-xs">Tax</p>
            <p className="text-white font-semibold">{fmt(tax)}</p>
          </div>
          <div className="flex-1 bg-white/20 rounded-xl px-3 py-2">
            <p className="text-emerald-100 text-xs">Total</p>
            <p className="text-white font-bold">{fmt(receipt.subtotal + tax + tip)}</p>
          </div>
        </div>

        {/* Tip row */}
        <div className="mt-2 bg-emerald-700/50 rounded-xl px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-emerald-200 text-xs">Tip</p>
            <p className="text-white font-semibold">{fmt(tip)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTipPercent(p => Math.max(0, p - 1))}
              className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-lg flex items-center justify-center active:bg-emerald-800"
            >
              −
            </button>
            <span className="text-white font-semibold text-sm w-10 text-center">{tipPercent}%</span>
            <button
              onClick={() => setTipPercent(p => p + 1)}
              className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-lg flex items-center justify-center active:bg-emerald-800"
            >
              +
            </button>
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
              <button onClick={() => removePerson(person.id)} className="text-emerald-400 text-xs ml-0.5">
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
            onClick={() => { setTab(t); setSelectedIds([]) }}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
              tab === t ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-400'
            }`}
          >
            {t}
            {t === 'items' && unassignedCount > 0 && (
              <span className="ml-1.5 bg-orange-100 text-orange-600 text-xs rounded-full px-1.5 py-0.5">
                {unassignedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Items tab */}
      {tab === 'items' && (
        <div className="flex-1 p-4 space-y-2">
          {people.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              Add people above, then select items to assign them.
            </div>
          )}

          {people.length > 0 && selectedIds.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-1">Tap items to select, then assign</p>
          )}

          {items.map(item => {
            const isSelected = selectedIds.includes(item.id)
            const assignedPeople = people.filter(p => item.assignedTo.includes(p.id))

            return (
              <button
                key={item.id}
                onClick={() => toggleSelect(item.id)}
                className={`w-full bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center gap-3 text-left active:scale-[0.99] transition-all ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-50 shadow-emerald-100'
                    : item.assignedTo.length === 0
                    ? 'border-orange-200'
                    : 'border-gray-100'
                }`}
              >
                {/* Checkbox */}
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                  }`}
                >
                  {isSelected && <span className="text-white text-xs leading-none">✓</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  {assignedPeople.length > 0 && (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      {assignedPeople.map(p => p.name).join(', ')}
                      {assignedPeople.length > 1 &&
                        ` · ${fmt(item.price / assignedPeople.length)} each`}
                    </p>
                  )}
                  {item.assignedTo.length === 0 && people.length > 0 && (
                    <p className="text-xs text-orange-400 mt-0.5">Unassigned</p>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 flex-shrink-0">{fmt(item.price)}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Summary tab */}
      {tab === 'summary' && (
        <div className="flex-1 p-4 space-y-3">
          {people.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Add people to see the breakdown</p>
          ) : (
            <>
              {totals.map(({ person, itemShare, taxShare, tipShare, total }) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  itemShare={itemShare}
                  taxShare={taxShare}
                  tipShare={tipShare}
                  tipPercent={tipPercent}
                  total={total}
                  items={items}
                  restaurantName={receipt.restaurantName}
                />
              ))}

              {unassignedCount > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
                  {unassignedCount} item{unassignedCount > 1 ? 's' : ''} not yet assigned — totals may be incomplete
                </div>
              )}

              <div className="bg-gray-100 rounded-xl px-4 py-3 flex justify-between text-sm font-semibold text-gray-700">
                <span>Total split</span>
                <span>{fmt(grandTotal)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating assign bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto p-4 bg-white border-t border-gray-100 shadow-lg z-40">
          <div className="flex gap-3">
            <button
              onClick={() => setSelectedIds([])}
              className="px-4 py-3 border border-gray-200 rounded-2xl text-sm text-gray-500 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => setAssigning(true)}
              className="flex-1 bg-emerald-600 text-white rounded-2xl py-3 font-semibold text-sm"
            >
              Assign {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} →
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal === 'addPerson' && (
        <AddPersonModal
          onAdd={p => setPeople(prev => [...prev, p])}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'saveGroup' && (
        <SaveGroupModal
          people={people}
          onSave={name => { saveGroup({ id: uid(), name, people }); setModal(null) }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'loadGroup' && (
        <LoadGroupModal onLoad={handleLoadGroup} onClose={() => setModal(null)} />
      )}
      {assigning && (
        <AssignSheet
          itemCount={selectedIds.length}
          initialAssigned={commonAssigned}
          people={people}
          onDone={applyAssignment}
          onClose={() => setAssigning(false)}
        />
      )}
    </div>
  )
}
