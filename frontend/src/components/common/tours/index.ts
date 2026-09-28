import i18n from 'i18next'
import { registerTours, warnMissingTours } from './registry'
import aiAssistantTours from './ai-assistant'
import analyticsTours from './analytics'
import dashboardTours from './dashboard'
import mySpaceTours from './my-space'
import performanceTours from './performance'
import setupCompanyTours from './setup-company'
import setupToolsTours from './setup-tools'

/**
 * Điểm nạp duy nhất của toàn bộ hướng dẫn. `TourHost` import file nay mot lan khi app
 * khởi động.
 *
 * Một file cho mỗi dòng sidebar có trang thật. Thêm một mục vào cây nav thì viết bài của
 * nó vào file của trang chứa nó — `warnMissingTours` bên dưới nhắc nếu quên.
 */
registerTours(() => dashboardTours())
registerTours(() => setupCompanyTours())
registerTours(() => setupToolsTours())
registerTours(() => performanceTours())
registerTours(() => mySpaceTours())
registerTours(() => analyticsTours())
registerTours(() => aiAssistantTours())

// Chỉ chạy khi i18next đã sẵn sàng: nhãn trong cảnh báo và cây nav đều là chữ đã dịch.
if (i18n.isInitialized) warnMissingTours()
else i18n.on('initialized', () => warnMissingTours())

export * from './registry'
export * from './chain'
