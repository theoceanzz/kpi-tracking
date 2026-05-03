export const ROLE_MAP: Record<string, string> = {
  // English Keys
  DIRECTOR: 'Giám đốc',
  HEAD: 'Trưởng phòng',
  DEPUTY: 'Phó phòng',
  LEADER: 'Trưởng nhóm',
  STAFF: 'Nhân viên',
  HR: 'Nhân sự',
  ADMIN: 'Quản trị viên',
  
  // Vietnamese Keys (for consistency)
  'Giám đốc': 'Giám đốc',
  'Trưởng phòng': 'Trưởng phòng',
  'Phó phòng': 'Phó phòng',
  'Trưởng nhóm': 'Trưởng nhóm',
  'Nhân viên': 'Nhân viên',
  'Nhân sự': 'Nhân sự',
  'Quản trị viên': 'Quản trị viên'
}

export const getRoleLabel = (role: string) => ROLE_MAP[role] || role
