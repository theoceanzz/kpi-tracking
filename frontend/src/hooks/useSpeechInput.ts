import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

/**
 * Nhập bằng giọng nói, dùng Web Speech API có sẵn của trình duyệt.
 *
 * <p><b>Không dùng model.</b> Model chat của dự án (`openai/gpt-oss-120b`) là text-only, và khối
 * cấu hình Gemini trong `application.yaml` là cấu hình chết — starter chỉ nằm trong một dòng
 * comment ở `pom.xml`. Nên nhận diện giọng nói dù sao cũng phải thêm thứ mới, và đây là phương án
 * duy nhất không thêm backend, không thêm phụ thuộc, không tốn phí.
 *
 * <p><b>Không byte âm thanh nào tới backend của ta.</b> Toàn bộ nằm trong trình duyệt, nên đường
 * ống AI, hạn mức token và `AttachmentPolicy` không liên quan gì.
 *
 * <p><b>Giới hạn, cần nói trước chứ đừng để người dùng tự phát hiện:</b> Firefox chưa hỗ trợ (khi
 * đó `supported` = false và nơi gọi ĐỪNG vẽ nút); cần internet vì Chrome gửi âm thanh tới máy chủ
 * Google, Safari tới Apple — môi trường on-premise không mạng sẽ không chạy.
 */

interface SpeechAlternative {
  transcript: string
}

interface SpeechResult {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: SpeechAlternative
}

interface SpeechResultList {
  readonly length: number
  readonly [index: number]: SpeechResult
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: SpeechResultList
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

/** Chrome/Edge dùng tiền tố webkit; chuẩn không tiền tố để dành cho tương lai. */
function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface UseSpeechInputOptions {
  /** Gọi mỗi lần chữ đổi, KỂ CẢ chữ tạm — nơi gọi cứ ghi thẳng vào ô. */
  onText: (fullText: string) => void
  /** Chữ đang có trong ô TRƯỚC khi bấm micro. Đọc lúc bắt đầu để nối thêm chứ không ghi đè. */
  getBaseText: () => string
}

export interface UseSpeechInputResult {
  /**
   * Trình duyệt có làm được không. Đây là một NĂNG LỰC chứ không phải cờ lỗi: false thì nơi gọi
   * đừng vẽ nút micro — cùng lối nghĩ với `FormFileSink`. Vẽ một cái nút bấm vào không làm gì là
   * kiểu hứa suông mà dự án này đã phải đi sửa nhiều lần.
   */
  supported: boolean
  listening: boolean
  start: () => void
  stop: () => void
}

export function useSpeechInput({ onText, getBaseText }: UseSpeechInputOptions): UseSpeechInputResult {
  const [listening, setListening] = useState(false)
  /** Bị từ chối quyền thì thôi mời tới hết phiên — hỏi lại mỗi lần bấm chỉ làm phiền. */
  const [denied, setDenied] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const baseRef = useRef('')
  const finalRef = useRef('')

  // Giữ callback trong ref: handler của SpeechRecognition được gắn MỘT lần lúc start, nếu đóng gói
  // bản chụp của lần render đó thì mọi chữ đọc được sẽ ghi vào state cũ.
  const onTextRef = useRef(onText)
  const getBaseTextRef = useRef(getBaseText)
  useEffect(() => {
    onTextRef.current = onText
    getBaseTextRef.current = getBaseText
  })

  const supported = speechRecognitionCtor() !== null && !denied

  const emit = useCallback((interim: string) => {
    const base = baseRef.current
    const spoken = (finalRef.current + interim).trim()
    if (!spoken) {
      onTextRef.current(base)
      return
    }
    // Nối thêm một dấu cách khi phần đã có không kết thúc bằng khoảng trắng, để chữ đọc được không
    // dính liền vào chữ người dùng vừa gõ dở.
    const needsGap = base.length > 0 && !/\s$/.test(base)
    onTextRef.current(base + (needsGap ? ' ' : '') + spoken)
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (listening) {
      stop()
      return
    }
    const Ctor = speechRecognitionCtor()
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.lang = 'vi-VN'
    // continuous: không đứt sau mỗi lần ngắt hơi. interimResults: chữ hiện NGAY khi đang nói —
    // đây chính là điều khiến phương án này đáng dùng so với việc chờ ghi âm xong rồi mới có chữ.
    recognition.continuous = true
    recognition.interimResults = true

    baseRef.current = getBaseTextRef.current()
    finalRef.current = ''

    recognition.onresult = event => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result) continue
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalRef.current += text
        else interim += text
      }
      emit(interim)
    }

    recognition.onerror = event => {
      // Hết một quãng im lặng thì trình duyệt báo no-speech rồi tự dừng. Đó là chuyện thường, kêu
      // lên chỉ làm phiền.
      if (event.error === 'no-speech' || event.error === 'aborted') return

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setDenied(true)
        toast.error('Trình duyệt chưa cho phép dùng micro. Hãy bật quyền micro cho trang này rồi tải lại.')
        return
      }
      if (event.error === 'network') {
        toast.error('Không nối được tới dịch vụ nhận diện giọng nói. Kiểm tra kết nối mạng giúp mình nhé.')
        return
      }
      toast.error('Nhận diện giọng nói gặp trục trặc, bạn thử lại giúp mình nhé.')
    }

    // Trình duyệt tự dừng sau một quãng im lặng. Không xử lý ở đây thì nút kẹt mãi ở trạng thái
    // "đang nghe" trong khi micro đã tắt.
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setListening(true)
    } catch {
      // start() ném khi đang có một phiên chạy dở — coi như không có gì xảy ra.
      setListening(false)
    }
  }, [listening, stop, emit])

  // Rời trang giữa lúc đang nghe thì phải tắt micro. Dùng abort chứ không stop: stop còn cố phát
  // nốt kết quả cuối vào một component đã unmount.
  useEffect(() => () => recognitionRef.current?.abort(), [])

  return { supported, listening, start, stop }
}
