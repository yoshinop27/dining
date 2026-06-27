'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSavedGroups, deleteGroup } from '@/lib/storage'
import type { Group } from '@/lib/types'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setGroups(getSavedGroups())
  }, [])

  const handleFile = async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/parse-receipt', { method: 'POST', body: form })
      if (!res.ok) throw new Error()
      const receipt = await res.json()
      sessionStorage.setItem('receipt', JSON.stringify(receipt))
      if (selectedGroupId) sessionStorage.setItem('preloadGroupId', selectedGroupId)
      else sessionStorage.removeItem('preloadGroupId')
      router.push('/split')
    } catch {
      setError('Could not read the receipt — try a clearer photo.')
      setLoading(false)
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const removeGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteGroup(id)
    setGroups(getSavedGroups())
    if (selectedGroupId === id) setSelectedGroupId(null)
  }

  const selectedGroup = groups.find(g => g.id === selectedGroupId)

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Reading your receipt...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col">
      <div className="bg-emerald-600 px-5 pt-14 pb-8">
        <h1 className="text-2xl font-bold text-white">Split the Bill</h1>
        <p className="text-emerald-100 text-sm mt-1">Scan a receipt and divide it instantly</p>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {selectedGroup && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Group ready</p>
              <p className="text-sm font-medium text-emerald-900">{selectedGroup.name}</p>
            </div>
            <button onClick={() => setSelectedGroupId(null)} className="text-emerald-400 text-sm font-medium">
              Clear
            </button>
          </div>
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onInputChange}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onInputChange}
        />

        <button
          onClick={() => cameraRef.current?.click()}
          className="w-full bg-emerald-600 text-white rounded-2xl py-5 font-semibold text-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
        >
          📸 Take Photo
        </button>

        <button
          onClick={() => galleryRef.current?.click()}
          className="w-full bg-white border-2 border-gray-200 text-gray-700 rounded-2xl py-4 font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          🖼️ Choose from Library
        </button>

        {groups.length > 0 && (
          <div className="pt-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Saved Groups
            </h2>
            <div className="space-y-2">
              {groups.map(group => (
                <div
                  key={group.id}
                  className={`bg-white rounded-xl border shadow-sm flex items-center cursor-pointer transition-colors ${
                    selectedGroupId === group.id ? 'border-emerald-400 bg-emerald-50' : 'border-gray-100'
                  }`}
                  onClick={() => setSelectedGroupId(selectedGroupId === group.id ? null : group.id)}
                >
                  <div className="flex-1 px-4 py-3">
                    <p className="font-medium text-gray-900 text-sm">{group.name}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {group.people.map(p => p.name).join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={(e) => removeGroup(group.id, e)}
                    className="pr-4 text-gray-300 text-xl leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
