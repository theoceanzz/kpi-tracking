/**
 * Tệp chọn từ thư viện tài liệu vẫn là BẢN SAO (một `File` như tệp từ máy); ở đây chỉ ghi nhớ nó được sao từ tài liệu
 * nào, gắn theo chính đối tượng `File` (WeakMap — không rò bộ nhớ, không đổi kiểu dữ liệu của các nơi đang dùng File[]).
 * Nơi gửi lên dùng {@link appendFilesWithSources} để kèm `sourceDocumentIds` song song với `files`.
 */
const sources = new WeakMap<File, string>()

export function markLibrarySource(file: File, documentId: string): File {
  sources.set(file, documentId)
  return file
}

export function librarySourceOf(file: File): string | undefined {
  return sources.get(file)
}

/**
 * Thêm `files` vào form; nếu có tệp từ thư viện thì thêm `sourceDocumentIds` cùng thứ tự ("-" = tệp từ máy). Không có
 * tệp nào từ thư viện thì không gửi trường này — máy chủ coi như tải từ máy như cũ.
 */
export function appendFilesWithSources(form: FormData, files: File[], field = 'files') {
  files.forEach((f) => form.append(field, f))
  if (files.some((f) => sources.has(f))) {
    files.forEach((f) => form.append('sourceDocumentIds', sources.get(f) ?? '-'))
  }
}
