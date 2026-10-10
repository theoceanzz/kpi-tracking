/**
 * Luật tệp đính kèm thảo luận / công việc — khớp `CollabAttachmentPolicy` ở backend (backend vẫn kiểm lại, kể cả
 * nội dung tệp). Kiểm ở đây chỉ để báo lỗi sớm, khỏi tải lên rồi mới bị từ chối.
 */
export const COLLAB_MAX_BYTES = 10 * 1024 * 1024
export const COLLAB_MAX_FILES_PER_COMMENT = 5
export const COLLAB_MAX_FILES_PER_TASK = 10
export const COLLAB_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip',
]
export const COLLAB_ACCEPT = COLLAB_EXTENSIONS.map((e) => `.${e}`).join(',')

export type FileProblem = { file: File; reason: 'type' | 'size' }

export function checkFiles(files: File[]): FileProblem[] {
  const problems: FileProblem[] = []
  for (const f of files) {
    const ext = f.name.includes('.') ? f.name.split('.').pop()!.toLowerCase() : ''
    if (!COLLAB_EXTENSIONS.includes(ext)) problems.push({ file: f, reason: 'type' })
    else if (f.size > COLLAB_MAX_BYTES) problems.push({ file: f, reason: 'size' })
  }
  return problems
}

export function isImageName(name: string) {
  return /\.(jpe?g|png|webp|gif)$/i.test(name)
}
