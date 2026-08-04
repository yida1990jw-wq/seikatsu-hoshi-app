import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAppData } from '../../context/AppDataContext'
import { PrintToolbar } from '../../components/PrintToolbar'
import { SlipCard } from '../../components/SlipCard'
import type { Assignment, Member, Program, ProgramType, Venue } from '../../types/domain'

type AssignmentDetail = Assignment & {
  member: Member | null
  partner: Member | null
  venue: Venue | null
  programs: (Program & { program_types: ProgramType | null }) | null
}

export function SlipPrintPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const { teachingPoints } = useAppData()
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!assignmentId) return
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('assignments')
        .select(
          '*, member:members!member_id(*), partner:members!partner_id(*), venue:venues(*), programs(*, program_types(*))',
        )
        .eq('id', assignmentId)
        .single()
      if (error) setError(error.message)
      else setAssignment(data as unknown as AssignmentDetail)
      setLoading(false)
    }
    load()
  }, [assignmentId])

  if (loading) return <div className="center-message">読み込み中...</div>
  if (error) return <div className="center-message error-text">{error}</div>
  if (!assignment || !assignment.programs) return <div className="center-message">データが見つかりません</div>

  const program = assignment.programs
  const teachingPoint = program.teaching_point_id
    ? (teachingPoints.find((t) => t.id === program.teaching_point_id) ?? null)
    : null

  return (
    <div>
      <PrintToolbar backTo="/" />
      <SlipCard
        member={assignment.member}
        partner={assignment.partner}
        venueName={assignment.venue?.name ?? null}
        program={program}
        teachingPoint={teachingPoint}
      />
    </div>
  )
}
