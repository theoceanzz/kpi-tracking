import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import { tourKit, tourTarget } from './kit'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Hướng dẫn trang "Đơn từ": tab Nộp đơn, rồi nối sang bài đi qua hộp nộp đơn (mở bằng `useTourModal('submitRequest')`;
 * nút Nộp gọi `blockedByTour()` nên không nộp thật).
 */

export const REQUEST_FORM: TourKey = 'requests+submit'

const { s, t, intro, modal } = tourKit('tourRequests')

const requestsTours = perLanguage((): Record<TourKey, TourDef> => {
  const submit = modal('submitRequest')
  return {
    requests: {
      version: 2,
      next: REQUEST_FORM,
      steps: [
        intro('intro'),
        s('tabs', tourTarget('ws.tabs'), 'bottom'),
        // Nút K.AI chỉ có khi tổ chức bật AI cho người xem.
        s('ai', tourTarget('requests.ai'), 'bottom', { requires: () => !!document.querySelector('[data-tour="requests.ai"]') }),
        s('search', tourTarget('requests.search'), 'bottom'),
        s('groups', tourTarget('requests.groups'), 'right'),
        s('forms', tourTarget('requests.forms'), 'top'),
      ],
    },
    [REQUEST_FORM]: {
      title: t('form.title'),
      cleanup: submit.close,
      steps: [
        submit.opener('form.open', tourTarget('requests.forms'), 'top'),
        submit.step('form.dialog', tourTarget('requests.submitDialog'), 'left'),
        submit.step('form.flow', tourTarget('requests.flowPreview'), 'top'),
        submit.step('form.send', tourTarget('requests.submitButton'), 'top'),
      ],
    },
  }
})

export default requestsTours
