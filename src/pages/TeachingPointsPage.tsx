import { supabase } from '../lib/supabaseClient'
import { useAppData } from '../context/AppDataContext'
import { SimpleCrudTable, type CrudColumn } from '../components/SimpleCrudTable'
import type { TeachingPoint } from '../types/domain'

const columns: CrudColumn<TeachingPoint>[] = [
  { key: 'code', label: '課題番号' },
  { key: 'title', label: '課題' },
  { key: 'page', label: 'ページ', placeholder: 'ページ(任意)' },
  { key: 'order_no', label: '並び順', type: 'number' },
]

export function TeachingPointsPage() {
  const { teachingPoints, refetchAll } = useAppData()

  async function handleAdd(values: Record<string, string>) {
    const { error } = await supabase.from('teaching_points').insert({
      code: values.code.trim(),
      title: values.title.trim(),
      page: values.page.trim() || null,
      order_no: values.order_no ? Number(values.order_no) : 0,
    })
    if (error) throw error
    await refetchAll()
  }

  async function handleUpdate(id: string, values: Record<string, string>) {
    const { error } = await supabase
      .from('teaching_points')
      .update({
        code: values.code.trim(),
        title: values.title.trim(),
        page: values.page.trim() || null,
        order_no: values.order_no ? Number(values.order_no) : 0,
      })
      .eq('id', id)
    if (error) throw error
    await refetchAll()
  }

  async function handleDelete(tp: TeachingPoint) {
    const { error } = await supabase.from('teaching_points').delete().eq('id', tp.id)
    if (error) throw error
    await refetchAll()
  }

  return (
    <div className="page">
      <h1>教励課題</h1>
      <SimpleCrudTable
        items={teachingPoints}
        columns={columns}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        itemLabel={(t) => `${t.code} ${t.title}`}
        searchPredicate={(t, q) => t.title.includes(q) || t.code.includes(q)}
      />
    </div>
  )
}
