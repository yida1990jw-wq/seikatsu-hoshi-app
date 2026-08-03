import { supabase } from '../lib/supabaseClient'
import { useAppData } from '../context/AppDataContext'
import { SimpleCrudTable, type CrudColumn } from '../components/SimpleCrudTable'
import type { Venue } from '../types/domain'

const columns: CrudColumn<Venue>[] = [{ key: 'name', label: '会場名' }]

export function VenuesPage() {
  const { venues, refetchAll } = useAppData()

  async function handleAdd(values: Record<string, string>) {
    const name = values.name.trim()
    if (!name) return
    const { error } = await supabase.from('venues').insert({ name })
    if (error) throw error
    await refetchAll()
  }

  async function handleUpdate(id: string, values: Record<string, string>) {
    const { error } = await supabase.from('venues').update({ name: values.name.trim() }).eq('id', id)
    if (error) throw error
    await refetchAll()
  }

  async function handleDelete(venue: Venue) {
    const { error } = await supabase.from('venues').delete().eq('id', venue.id)
    if (error) throw error
    await refetchAll()
  }

  return (
    <div className="page">
      <h1>会場</h1>
      <SimpleCrudTable
        items={venues}
        columns={columns}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        itemLabel={(v) => v.name}
      />
    </div>
  )
}
