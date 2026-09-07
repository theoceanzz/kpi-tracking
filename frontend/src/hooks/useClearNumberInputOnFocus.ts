import { useEffect } from 'react'

/**
 * Ô nhập số trong toàn app: bấm vào là trống trơn để gõ số mới luôn, khỏi phải bôi đen
 * xoá tay giá trị cũ. Rời ô mà chưa gõ gì thì giá trị cũ được trả lại.
 *
 * <p>Cố tình KHÔNG bắn sự kiện input khi xoá và khi khôi phục: chỉ đổi phần hiển thị trong
 * DOM, còn state phía React (react-hook-form, useState...) giữ nguyên giá trị cũ. Nhờ vậy
 * form không bị đánh dấu dirty, không dính lỗi validate "bắt buộc" lúc ô đang trống, và ô
 * controlled cũng không bị component cha ghi "0" đè lại ngay khi vừa focus. React vẫn nhận
 * onChange bình thường lúc người dùng gõ, vì bản thân phép gán value đã cập nhật value
 * tracker của React về chuỗi rỗng.
 *
 * <p>Ô nào cần giữ nguyên giá trị khi focus thì thêm thuộc tính `data-keep-value-on-focus`.
 */
export function useClearNumberInputOnFocus() {
  useEffect(() => {
    // Giá trị cũ của ô đang focus, giữ lại để khôi phục nếu người dùng không gõ gì.
    const previous = new WeakMap<HTMLInputElement, string>()

    const isNumberInput = (target: EventTarget | null): target is HTMLInputElement =>
      target instanceof HTMLInputElement &&
      target.type === 'number' &&
      !target.readOnly &&
      !target.disabled &&
      target.dataset['keepValueOnFocus'] === undefined

    const handleFocusIn = (e: FocusEvent) => {
      const el = e.target
      if (!isNumberInput(el) || el.value === '') return
      previous.set(el, el.value)
      el.value = ''
    }

    // Người dùng đã gõ thì giá trị cũ hết vai trò — kể cả khi họ xoá hết để ô rỗng thật.
    const handleInput = (e: Event) => {
      if (isNumberInput(e.target)) previous.delete(e.target)
    }

    const handleFocusOut = (e: FocusEvent) => {
      const el = e.target
      if (!isNumberInput(el)) return
      const old = previous.get(el)
      previous.delete(el)
      if (old !== undefined && el.value === '') el.value = old
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('input', handleInput)
    document.addEventListener('focusout', handleFocusOut)
    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('input', handleInput)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [])
}
