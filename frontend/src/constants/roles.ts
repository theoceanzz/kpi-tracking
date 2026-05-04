export const ROLE_MAP: Record<string, string> = {
  // English System Keys (mapping to Vietnamese labels)
  DIRECTOR: 'Giám đốc',
  HEAD: 'Trưởng phòng',
  DEPUTY: 'Phó phòng',
  LEADER: 'Trưởng nhóm',
  STAFF: 'Nhân viên',
  HR: 'Nhân sự',
  ADMIN: 'Quản trị viên',
  DIRECTOR_SYSTEM: 'Quản trị hệ thống'
}

export const getRoleLabel = (role: string) => ROLE_MAP[role] || role
