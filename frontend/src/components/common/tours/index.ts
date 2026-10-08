import i18n from 'i18next'
import { registerTours, warnMissingTours } from './registry'
import aiAssistantTours from './ai-assistant'
import analyticsTours from './analytics'
import dashboardTours from './dashboard'
import formsCompanyTours from './forms-company'
import formsToolsTours from './forms-tools'
import formsPerformanceTours from './forms-performance'
import formsMeTours from './forms-me'
import formsWorkTours from './forms-work'
import kpiCreateTours from './kpi-create'
import mySpaceTours from './my-space'
import performanceTours from './performance'
import setupCompanyTours from './setup-company'
import setupToolsTours from './setup-tools'
import workTours from './work'

/**
 * Điểm nạp duy nhất của toàn bộ hướng dẫn. `TourHost` import file nay mot lan khi app
 * khởi động.
 *
 * Một file cho mỗi dòng sidebar có trang thật. Thêm một mục vào cây nav thì viết bài của
 * nó vào file của trang chứa nó — `warnMissingTours` bên dưới nhắc nếu quên.
 */
registerTours(() => dashboardTours())
registerTours(() => setupCompanyTours())
registerTours(() => formsCompanyTours())
registerTours(() => setupToolsTours())
registerTours(() => formsToolsTours())
registerTours(() => performanceTours())
registerTours(() => formsPerformanceTours())
registerTours(() => kpiCreateTours())
registerTours(() => mySpaceTours())
registerTours(() => formsMeTours())
registerTours(() => analyticsTours())
registerTours(() => aiAssistantTours())
registerTours(() => workTours())
registerTours(() => formsWorkTours())

// Chỉ chạy khi i18next đã sẵn sàng: nhãn trong cảnh báo và cây nav đều là chữ đã dịch.
if (i18n.isInitialized) warnMissingTours()
else i18n.on('initialized', () => warnMissingTours())

export * from './registry'
export * from './chain'
