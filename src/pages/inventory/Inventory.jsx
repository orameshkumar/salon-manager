import { useState } from 'react'
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCollection } from '../../hooks/useCollection'
import PageHeader from '../../components/PageHeader'
import toast from 'react-hot-toast'

const CATEGORIES = ['Hair care', 'Skin care', 'Nail care', 'Tools & equipment', 'Consumables', 'Retail products']
const EMPTY = { name: '', category: '', sku: '', quantity: '', reorderLevel: '5', unit: 'units', costPrice: '' }

const DEFAULT_ITEMS = [
  { name: 'Shampoo (500ml)',         category: 'Hair care',        unit: 'bottles',  quantity: 20, reorderLevel: 5,  costPrice: 250 },
  { name: 'Conditioner (500ml)',     category: 'Hair care',        unit: 'bottles',  quantity: 15, reorderLevel: 5,  costPrice: 220 },
  { name: 'Hair colour (tube)',      category: 'Hair care',        unit: 'tubes',    quantity: 30, reorderLevel: 10, costPrice: 180 },
  { name: 'Hair colour developer',   category: 'Hair care',        unit: 'bottles',  quantity: 15, reorderLevel: 5,  costPrice: 150 },
  { name: 'Hair serum',              category: 'Hair care',        unit: 'bottles',  quantity: 10, reorderLevel: 3,  costPrice: 300 },
  { name: 'Hair mask (200g)',        category: 'Hair care',        unit: 'jars',     quantity: 10, reorderLevel: 3,  costPrice: 400 },
  { name: 'Bleach powder',           category: 'Hair care',        unit: 'packets',  quantity: 20, reorderLevel: 5,  costPrice: 120 },
  { name: 'Face wash',               category: 'Skin care',        unit: 'bottles',  quantity: 10, reorderLevel: 3,  costPrice: 200 },
  { name: 'Facial cream',            category: 'Skin care',        unit: 'jars',     quantity: 10, reorderLevel: 3,  costPrice: 350 },
  { name: 'Scrub (100g)',            category: 'Skin care',        unit: 'jars',     quantity: 8,  reorderLevel: 2,  costPrice: 280 },
  { name: 'Sunscreen SPF50',         category: 'Skin care',        unit: 'tubes',    quantity: 8,  reorderLevel: 2,  costPrice: 320 },
  { name: 'Wax strips',              category: 'Skin care',        unit: 'packets',  quantity: 20, reorderLevel: 5,  costPrice: 90  },
  { name: 'Hot wax (500g)',          category: 'Skin care',        unit: 'jars',     quantity: 5,  reorderLevel: 2,  costPrice: 450 },
  { name: 'Nail polish (assorted)',  category: 'Nail care',        unit: 'bottles',  quantity: 30, reorderLevel: 10, costPrice: 80  },
  { name: 'Nail polish remover',     category: 'Nail care',        unit: 'bottles',  quantity: 10, reorderLevel: 3,  costPrice: 60  },
  { name: 'Nail file',               category: 'Nail care',        unit: 'pieces',   quantity: 20, reorderLevel: 5,  costPrice: 15  },
  { name: 'Cuticle oil',             category: 'Nail care',        unit: 'bottles',  quantity: 8,  reorderLevel: 2,  costPrice: 120 },
  { name: 'Hair dryer',              category: 'Tools & equipment',unit: 'pieces',   quantity: 3,  reorderLevel: 1,  costPrice: 2500 },
  { name: 'Flat iron / straightener',category: 'Tools & equipment',unit: 'pieces',   quantity: 2,  reorderLevel: 1,  costPrice: 1800 },
  { name: 'Curling tong',            category: 'Tools & equipment',unit: 'pieces',   quantity: 2,  reorderLevel: 1,  costPrice: 1500 },
  { name: 'Hair cutting scissors',   category: 'Tools & equipment',unit: 'pairs',    quantity: 5,  reorderLevel: 2,  costPrice: 800 },
  { name: 'Razor / trimmer blades',  category: 'Tools & equipment',unit: 'packets',  quantity: 10, reorderLevel: 3,  costPrice: 50  },
  { name: 'Cape / salon gown',       category: 'Tools & equipment',unit: 'pieces',   quantity: 10, reorderLevel: 3,  costPrice: 200 },
  { name: 'Disposable gloves',       category: 'Consumables',      unit: 'boxes',    quantity: 10, reorderLevel: 3,  costPrice: 150 },
  { name: 'Cotton pads',             category: 'Consumables',      unit: 'packs',    quantity: 15, reorderLevel: 5,  costPrice: 80  },
  { name: 'Tissue / towels',         category: 'Consumables',      unit: 'rolls',    quantity: 20, reorderLevel: 5,  costPrice: 40  },
  { name: 'Foil sheets',             category: 'Consumables',      unit: 'rolls',    quantity: 5,  reorderLevel: 2,  costPrice: 120 },
  { name: 'Mixing bowl & brush',     category: 'Consumables',      unit: 'sets',     quantity: 5,  reorderLevel: 2,  costPrice: 60  },
]

export default function Inventory() {
  const { docs: items, loading } = useCollection('inventory', 'name')
  const [showForm, setShowForm]  = useState(false)
  const [editDoc, setEditDoc]    = useState(null)
  const [form, setForm]          = useState(EMPTY)
  const [saving, setSaving]      = useState(false)
  const [deleting, setDeleting]  = useState(null)
  const [filter, setFilter]      = useState('all')

  const lowStock = items.filter((i) => Number(i.quantity) <= Number(i.reorderLevel ?? 5))
  const filtered = filter === 'low' ? lowStock
    : filter === 'all' ? items
    : items.filter((i) => i.category === filter)

  function openAdd() {
    setEditDoc(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(item) {
    setEditDoc(item)
    setForm({
      name: item.name, category: item.category || '', sku: item.sku || '',
      quantity: item.quantity, reorderLevel: item.reorderLevel ?? 5,
      unit: item.unit || 'units', costPrice: item.costPrice || '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditDoc(null)
    setForm(EMPTY)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        ...form,
        quantity:     Number(form.quantity),
        reorderLevel: Number(form.reorderLevel),
        costPrice:    Number(form.costPrice),
      }
      if (editDoc) {
        await updateDoc(doc(db, 'inventory', editDoc.id), { ...data, updatedAt: serverTimestamp() })
        toast.success('Item updated')
      } else {
        await addDoc(collection(db, 'inventory'), { ...data, createdAt: serverTimestamp() })
        toast.success('Item added')
      }
      closeForm()
    } catch {
      toast.error('Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  async function loadDefaults() {
    const existingNames = new Set(items.map((i) => i.name.toLowerCase()))
    const toAdd = DEFAULT_ITEMS.filter((d) => !existingNames.has(d.name.toLowerCase()))
    if (!toAdd.length) { toast.success('All default items already exist'); return }
    setSaving(true)
    try {
      await Promise.all(toAdd.map((d) =>
        addDoc(collection(db, 'inventory'), { ...d, createdAt: serverTimestamp() })
      ))
      toast.success(`Added ${toAdd.length} default item${toAdd.length > 1 ? 's' : ''}`)
    } catch {
      toast.error('Failed to load defaults')
    } finally {
      setSaving(false)
    }
  }

  async function adjustStock(id, delta) {
    const item   = items.find((i) => i.id === id)
    const newQty = Math.max(0, (item?.quantity ?? 0) + delta)
    await updateDoc(doc(db, 'inventory', id), { quantity: newQty })
    toast.success('Stock updated')
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"?`)) return
    setDeleting(item.id)
    try {
      await deleteDoc(doc(db, 'inventory', item.id))
      toast.success('Item deleted')
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Inventory"
        subtitle={`${items.length} items · ${lowStock.length} low stock`}
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={loadDefaults} disabled={saving}>Load defaults</button>
            <button className="btn-primary" onClick={openAdd}>+ Add item</button>
          </div>
        }
      />

      {lowStock.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          ⚠ {lowStock.length} item{lowStock.length > 1 ? 's' : ''} below reorder level:{' '}
          {lowStock.map((i) => i.name).join(', ')}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'low', ...CATEGORIES].map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === cat ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {cat === 'all' ? 'All' : cat === 'low' ? `⚠ Low stock (${lowStock.length})` : cat}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="card mb-6 border-brand-200">
          <p className="text-sm font-medium text-gray-800 mb-4">
            {editDoc ? `Edit — ${editDoc.name}` : 'Add inventory item'}
          </p>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input className="input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select className="input" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Select</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">SKU</label>
              <input className="input" value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quantity *</label>
              <input className="input" type="number" min="0" required value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reorder level</label>
              <input className="input" type="number" min="0" value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
              <input className="input" value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cost price (₹)</label>
              <input className="input" type="number" min="0" value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
            </div>
            <div className="col-span-3 flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editDoc ? 'Update item' : 'Add item'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Category', 'SKU', 'Quantity', 'Reorder at', 'Cost price', 'Adjust', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">No items found</td></tr>
              )}
              {filtered.map((item) => {
                const isLow = Number(item.quantity) <= Number(item.reorderLevel ?? 5)
                return (
                  <tr key={item.id} className={`hover:bg-gray-50 ${isLow ? 'bg-amber-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600">{item.category || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.sku || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={isLow ? 'badge-red' : 'badge-green'}>
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.reorderLevel ?? 5}</td>
                    <td className="px-4 py-3 text-gray-600">₹{item.costPrice ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => adjustStock(item.id, -1)}
                          className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 text-xs">−</button>
                        <button onClick={() => adjustStock(item.id, 1)}
                          className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 text-xs">+</button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="text-xs text-blue-600 hover:underline" onClick={() => openEdit(item)}>Edit</button>
                        <button
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          disabled={deleting === item.id}
                          onClick={() => handleDelete(item)}
                        >
                          {deleting === item.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
