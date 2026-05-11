import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TourPageKey =
  | 'dashboard-director'
  | 'dashboard-head'
  | 'dashboard-staff'
  | 'company'
  | 'roles'
  | 'org-structure'
  | 'users'
  | 'settings'
  | 'kpi-criteria'
  | 'kpi-periods'
  | 'kpi-pending'
  | 'kpi-adjustments'
  | 'submissions-org'
  | 'my-kpi'
  | 'my-submissions'
  | 'my-adjustments'
  | 'evaluations'
  | 'analytics'

interface TourState {
  /** Map of userId → (map of pageKey → whether tour has been seen) */
  seenToursByUser: Record<string, Record<string, boolean>>
  /** The page key currently running a tour (null if none) */
  activeTour: TourPageKey | null
  /** Mark a page tour as seen for a specific user */
  markSeen: (pageKey: TourPageKey, userId: string) => void
  /** Start a tour for a page (used for both first-time and replay) */
  startTour: (pageKey: TourPageKey) => void
  /** Stop the active tour */
  stopTour: () => void
  /** Check if a page tour has been seen by a specific user */
  hasSeen: (pageKey: TourPageKey, userId: string) => boolean
  /** Reset a specific page tour for a user so it can replay */
  resetTour: (pageKey: TourPageKey, userId: string) => void
  /** Reset all tours for all users */
  resetAll: () => void
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      seenToursByUser: {},
      activeTour: null,

      markSeen: (pageKey, userId) =>
        set((state) => {
          const userSeen = state.seenToursByUser[userId] || {}
          return {
            seenToursByUser: { 
              ...state.seenToursByUser, 
              [userId]: { ...userSeen, [pageKey]: true } 
            },
            activeTour: state.activeTour === pageKey ? null : state.activeTour,
          }
        }),

      startTour: (pageKey) =>
        set({ activeTour: pageKey }),

      stopTour: () =>
        set({ activeTour: null }),

      hasSeen: (pageKey, userId) => {
        if (!userId) return true // Don't show tours if not logged in
        return !!get().seenToursByUser[userId]?.[pageKey]
      },

      resetTour: (pageKey, userId) =>
        set((state) => {
          const userSeen = { ...(state.seenToursByUser[userId] || {}) }
          delete userSeen[pageKey]
          return {
            seenToursByUser: {
              ...state.seenToursByUser,
              [userId]: userSeen
            }
          }
        }),

      resetAll: () =>
        set({ seenToursByUser: {}, activeTour: null }),
    }),
    {
      name: 'tour-storage',
      partialize: (state) => ({ seenToursByUser: state.seenToursByUser }),
    }
  )
)
