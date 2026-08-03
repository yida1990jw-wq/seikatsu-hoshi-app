export const POSITIONS = ['長老', '援助奉仕者', '成員', '伝道者', '入校者'] as const
export type Position = (typeof POSITIONS)[number]

export const MEMBER_STATUSES = ['現役', '転出', '休止', '対象外'] as const
export type MemberStatus = (typeof MEMBER_STATUSES)[number]

export const GENDERS = ['男性', '女性'] as const
export type Gender = (typeof GENDERS)[number]

export const QUALIFICATIONS = ['祈り', '聖書研究朗読者', '聖書研究司会', '全体司会', '朗読', '話'] as const
export type Qualification = (typeof QUALIFICATIONS)[number]

export interface Member {
  id: string
  last_name: string
  first_name: string
  last_name_kana: string | null
  first_name_kana: string | null
  gender: Gender
  honorific: string
  position: Position
  status: MemberStatus
  qualifications: Qualification[] | null
  created_at: string
}

export interface Venue {
  id: string
  name: string
}

export interface ProgramType {
  id: string
  name: string
  required_position: Position[] | null
  required_gender: Gender | null
  needs_partner: boolean | null
  partner_same_gender: boolean | null
  required_qualification: Qualification | null
  partner_program_type_id: string | null
}

export interface Program {
  id: string
  date: string
  section: string | null
  program_type_id: string | null
  title: string | null
  order_no: number | null
  duration_minutes: number | null
  material: string | null
  content: string | null
  song_id: string | null
  teaching_point_id: string | null
}

export interface Song {
  id: string
  number: number
  title: string
  scripture: string | null
}

export interface TeachingPoint {
  id: string
  code: string
  title: string
  page: string | null
  order_no: number
}

export interface Assignment {
  id: string
  program_id: string | null
  member_id: string | null
  partner_id: string | null
  venue_id: string | null
  created_at: string
}
