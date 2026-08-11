import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Ô nhập số nguyên có dấu phân cách hàng nghìn kiểu Việt (100.000) ngay trong lúc gõ.
 *
 * <p>Định dạng lại sau mỗi phím sẽ làm con trỏ nhảy về cuối, nên component tự đặt lại vị trí con
 * trỏ. Mốc dùng để đặt lại là <b>số chữ số đứng trước con trỏ</b> chứ không phải chỉ số ký tự —
 * vì dấu chấm bị chèn thêm hoặc bớt đi sau mỗi lần định dạng nên chỉ số ký tự không còn đúng.
 */
interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  /** Giới hạn số chữ số, mặc định 15 để không vượt ngưỡng số nguyên an toàn của JavaScript. */
  maxDigits?: number
}

const format = (n: number) => n.toLocaleString('vi-VN')
const digitsOf = (s: string) => s.replace(/\D/g, '')

/** Vị trí ký tự nằm ngay sau chữ số thứ n trong chuỗi đã định dạng. */
function caretAfterDigits(text: string, n: number): number {
  if (n <= 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    // charAt trả về string (không phải string | undefined như text[i]) nên hợp với
    // noUncheckedIndexedAccess đang bật của dự án.
    const ch = text.charAt(i)
    if (ch >= '0' && ch <= '9') {
      seen++
      if (seen === n) return i + 1
    }
  }
  return text.length
}

export default function NumberInput({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  maxDigits = 15,
}: NumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)
  const [text, setText] = useState(() => format(value))

  // Đồng bộ khi giá trị từ bên ngoài đổi (tải lại dữ liệu, huỷ sửa...). So theo SỐ đã lọc chứ
  // không so chuỗi: ô để trống và giá trị 0 là cùng một số, nên người dùng xoá hết vẫn để trống
  // được thay vì bị lấp lại "0" ngay lập tức.
  useEffect(() => {
    const digits = digitsOf(text)
    const shown = digits === '' ? 0 : Number(digits)
    if (shown !== value) setText(format(value))
    // Chỉ chạy khi giá trị ngoài đổi; thêm text vào đây sẽ ghi đè lên chuỗi đang gõ dở.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Đặt lại con trỏ trước khi trình duyệt vẽ, tránh thấy con trỏ nháy ở cuối rồi mới nhảy về.
  useLayoutEffect(() => {
    if (caretRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(caretRef.current, caretRef.current)
      caretRef.current = null
    }
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const caret = e.target.selectionStart ?? raw.length
    const digitsBeforeCaret = digitsOf(raw.slice(0, caret)).length

    const digits = digitsOf(raw).slice(0, maxDigits)
    const next = digits === '' ? 0 : Number(digits)
    const formatted = digits === '' ? '' : format(next)

    setText(formatted)
    caretRef.current = caretAfterDigits(formatted, digitsBeforeCaret)
    onChange(next)
  }

  return (
    <input
      ref={inputRef}
      value={text}
      onChange={handleChange}
      onBlur={() => setText(format(value))}
      disabled={disabled}
      placeholder={placeholder}
      inputMode="numeric"
      className={className}
    />
  )
}
