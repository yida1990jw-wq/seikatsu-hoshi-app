import { supabase } from '../lib/supabaseClient'
import { useAppData } from '../context/AppDataContext'
import { SimpleCrudTable, type CrudColumn } from '../components/SimpleCrudTable'
import type { Song } from '../types/domain'

const columns: CrudColumn<Song>[] = [
  { key: 'number', label: '番号', type: 'number' },
  { key: 'title', label: 'タイトル' },
  { key: 'scripture', label: '聖句', placeholder: '聖句(任意)' },
]

export function SongsPage() {
  const { songs, refetchAll } = useAppData()

  async function handleAdd(values: Record<string, string>) {
    const { error } = await supabase.from('songs').insert({
      number: Number(values.number),
      title: values.title.trim(),
      scripture: values.scripture.trim() || null,
    })
    if (error) throw error
    await refetchAll()
  }

  async function handleUpdate(id: string, values: Record<string, string>) {
    const { error } = await supabase
      .from('songs')
      .update({
        number: Number(values.number),
        title: values.title.trim(),
        scripture: values.scripture.trim() || null,
      })
      .eq('id', id)
    if (error) throw error
    await refetchAll()
  }

  async function handleDelete(song: Song) {
    const { error } = await supabase.from('songs').delete().eq('id', song.id)
    if (error) throw error
    await refetchAll()
  }

  return (
    <div className="page">
      <h1>歌</h1>
      <SimpleCrudTable
        items={songs}
        columns={columns}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        itemLabel={(s) => `${s.number}番 ${s.title}`}
        searchPredicate={(s, q) => s.title.includes(q) || String(s.number).includes(q)}
      />
    </div>
  )
}
