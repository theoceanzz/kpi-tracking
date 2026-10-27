import { useCallback, useLayoutEffect, useReducer, useRef } from 'react'
import type { ProcessGraph } from '../types'

const LIMIT = 50

interface State {
  past: ProcessGraph[]
  present: ProcessGraph
  future: ProcessGraph[]
}

type Action =
  | { type: 'set'; graph: ProcessGraph; record: boolean; base?: ProcessGraph }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; graph: ProcessGraph }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set': {
      if (!action.base && action.graph === state.present) return state
      if (!action.record) return { ...state, present: action.graph }
      const base = action.base ?? state.present
      return { past: [...state.past, base].slice(-LIMIT), present: action.graph, future: [] }
    }
    case 'undo': {
      const prev = state.past[state.past.length - 1]
      if (!prev) return state
      return { past: state.past.slice(0, -1), present: prev, future: [state.present, ...state.future] }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return { past: [...state.past, state.present].slice(-LIMIT), present: next, future: rest }
    }
    case 'reset':
      return { past: [], present: action.graph, future: [] }
  }
}

/**
 * Hoàn tác / làm lại cho khung vẽ (tối đa {@link LIMIT} bước). Kéo node là một chuỗi cập nhật
 * vị trí liên tục: {@code beginTransient} chụp sơ đồ lúc bắt đầu kéo, các bước giữa chừng không ghi
 * lịch sử, {@code endTransient} ghi đúng một bước cho cả lần kéo.
 */
export function useGraphHistory(initial: ProcessGraph) {
  const [state, dispatch] = useReducer(reducer, { past: [], present: initial, future: [] })
  const transientBase = useRef<ProcessGraph | null>(null)
  const presentRef = useRef(state.present)
  useLayoutEffect(() => { presentRef.current = state.present })

  const set = useCallback((graph: ProcessGraph) => dispatch({ type: 'set', graph, record: true }), [])
  const reset = useCallback((graph: ProcessGraph) => dispatch({ type: 'reset', graph }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  const beginTransient = useCallback(() => {
    if (!transientBase.current) transientBase.current = presentRef.current
  }, [])
  const setTransient = useCallback((graph: ProcessGraph) => dispatch({ type: 'set', graph, record: false }), [])
  const endTransient = useCallback(() => {
    const base = transientBase.current
    transientBase.current = null
    if (base && base !== presentRef.current) {
      dispatch({ type: 'set', graph: presentRef.current, record: true, base })
    }
  }, [])

  return {
    graph: state.present,
    set,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    beginTransient,
    setTransient,
    endTransient,
  }
}

export type GraphHistory = ReturnType<typeof useGraphHistory>
