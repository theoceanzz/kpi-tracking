import type { TourKey } from '@/store/tourStore'
import type { TourDef } from './registry'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Hướng dẫn cho "K.AI" — trang trợ lý toàn màn hình.
 *
 * Trang không có mục con, và cũng không có neo `tour-*` nào: nó là một khung hội thoại
 * chiếm trọn màn hình chứ không phải bảng biểu có các khối rời. Dùng bước căn giữa —
 * nội dung cần nói ở đây là "hỏi được cái gì" chứ không phải "ô này nằm đâu".
 */

const note = (text: string) => (
  <p className="text-xs bg-[var(--color-primary-soft)] p-2 rounded-control text-[var(--color-primary)] font-medium italic">
    💡 {text}
  </p>
)

const warn = (text: string) => (
  <p className="text-xs bg-[var(--color-warning-bg)] p-2 rounded-control text-[var(--color-warning)] font-medium italic border-l-4 border-[var(--color-warning-border)]">
    ⚠️ {text}
  </p>
)

const aiAssistantTours = perLanguage((): Record<TourKey, TourDef> => ({
  'ai-assistant': {
    steps: [
      {
        target: 'body',
        title: i18n.t('shared:ai_assistant.askInPlainLanguage'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:ai_assistant.kAiCanReadKpiData')}
            </p>
            <p className="text-caption">
              {i18n.t('shared:ai_assistant.theAssistantSeesExactlyWhatYou')}
            </p>
          </div>
        ),
        placement: 'center',
      },
      {
        target: 'body',
        title: i18n.t('shared:ai_assistant.suggestionsAndPastConversations'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:ai_assistant.theSuggestionCardsAtTheTop')}
            </p>
            {note(i18n.t('shared:ai_assistant.conversationsKeepTheirThreadSoYou'))}
          </div>
        ),
        placement: 'center',
      },
      {
        target: 'body',
        title: i18n.t('shared:ai_assistant.eachQuestionUsesQuota'),
        content: (
          <div className="space-y-2">
            <p>
              {i18n.t('shared:ai_assistant.theAssistantUsesTheTokenQuota')}
            </p>
            {warn(i18n.t('shared:ai_assistant.figuresSummarizedByTheAssistantShould'))}
          </div>
        ),
        placement: 'center',
      },
    ],
  },
}))

export default aiAssistantTours
