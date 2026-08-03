import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { buildLastAssignedMap, type AssignmentHistoryRow, type LastAssignedMap } from '../lib/candidates'
import type { Member, ProgramType, Venue } from '../types/domain'

interface AppDataContextValue {
  members: Member[]
  venues: Venue[]
  programTypes: ProgramType[]
  lastAssignedMap: LastAssignedMap
  loading: boolean
  error: string | null
  refetchHistory: () => Promise<void>
  refetchAll: () => Promise<void>
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [programTypes, setProgramTypes] = useState<ProgramType[]>([])
  const [lastAssignedMap, setLastAssignedMap] = useState<LastAssignedMap>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from('assignments')
      .select('member_id, partner_id, programs(date, program_type_id)')

    if (error) throw error

    const rows: AssignmentHistoryRow[] = (data ?? []).map((row) => {
      const program = Array.isArray(row.programs) ? row.programs[0] : row.programs
      return {
        member_id: row.member_id,
        partner_id: row.partner_id,
        program_date: program?.date ?? null,
        program_type_id: program?.program_type_id ?? null,
      }
    })

    setLastAssignedMap(buildLastAssignedMap(rows))
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [membersRes, venuesRes, programTypesRes] = await Promise.all([
        supabase.from('members').select('*').order('last_name_kana', { ascending: true }),
        supabase.from('venues').select('*').order('name', { ascending: true }),
        supabase.from('program_types').select('*'),
      ])

      if (membersRes.error) throw membersRes.error
      if (venuesRes.error) throw venuesRes.error
      if (programTypesRes.error) throw programTypesRes.error

      setMembers(membersRes.data ?? [])
      setVenues(venuesRes.data ?? [])
      setProgramTypes(programTypesRes.data ?? [])

      await fetchHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [fetchHistory])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <AppDataContext.Provider
      value={{
        members,
        venues,
        programTypes,
        lastAssignedMap,
        loading,
        error,
        refetchHistory: fetchHistory,
        refetchAll: fetchAll,
      }}
    >
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
