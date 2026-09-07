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
registerTours(dashboardTours)
registerTours(setupCompanyTours)
registerTours(setupToolsTours)
registerTours(performanceTours)
registerTours(mySpaceTours)
registerTours(analyticsTours)
registerTours(aiAssistantTours)

warnMissingTours()

export * from './registry'
export * from './chain'
