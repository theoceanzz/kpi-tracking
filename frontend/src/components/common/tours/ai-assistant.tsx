import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import { tourKit, tourTarget } from './kit'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Hướng dẫn cho trang K.AI. Bản 2 viết lại theo khuôn từng bước nhỏ (xem `kit.tsx`): bản 1 chỉ có
 * ba bước đứng giữa màn hình, không chỉ vào đâu.
 */

const { s, intro } = tourKit('tourAiAssistant')

const aiAssistantTours = perLanguage((): Record<TourKey, TourDef> => ({
  'ai-assistant': {
    version: 2,
    steps: [
      intro('intro'),
      s('starter', tourTarget('ai.starter'), 'top'),
      s('composer', tourTarget('ai.composer'), 'top'),
      s('send', tourTarget('ai.send'), 'top'),
      s('sidebar', tourTarget('ai.sidebar'), 'right'),
      s('new', tourTarget('ai.new'), 'right'),
      s('quota', 'body', 'center'),
    ],
  },
}))

export default aiAssistantTours
