import type { ReactElement } from 'react'
import { act, renderHook } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import type { FollowerRemoval } from '../types'
import { useFollowerRemovalConfirm } from './useFollowerRemovalConfirm'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))

const removal = (taskId: string, userId: string, subtask = false): FollowerRemoval =>
  ({ taskId, taskTitle: `Việc ${taskId}`, subtask, userId, userName: `Người ${userId}`, avatarUrl: null })

const unconfirmed = () => new AxiosError('409', 'ERR_BAD_REQUEST', undefined, undefined,
  { status: 409, data: { code: 'TASK_FOLLOWER_REMOVAL_UNCONFIRMED', message: 'Danh sách vừa thay đổi' } } as AxiosResponse)

/** Bấm "Gỡ và đổi KPI" của hộp đang mở. */
const confirmDialog = (dialog: unknown) => (dialog as ReactElement<{ onConfirm: () => Promise<void> }>).props.onConfirm()

describe('useFollowerRemovalConfirm', () => {
  it('không ai bị gỡ ⇒ gửi luôn với danh sách rỗng, không mở hộp', async () => {
    const commit = vi.fn().mockResolvedValue('ok')
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useFollowerRemovalConfirm())
    await act(() => result.current.start({ preview: async () => [], commit, onSuccess, onError: vi.fn() }))
    expect(commit).toHaveBeenCalledWith([])
    expect(onSuccess).toHaveBeenCalledWith('ok')
    expect(result.current.dialog).toBeFalsy()
  })

  it('có người bị gỡ ⇒ chỉ gửi sau khi xác nhận, kèm đúng các cặp (việc, người) — cả việc con', async () => {
    const commit = vi.fn().mockResolvedValue('ok')
    const { result } = renderHook(() => useFollowerRemovalConfirm())
    const list = [removal('t1', 'u1'), removal('s1', 'u1', true)]
    await act(() => result.current.start({ preview: async () => list, commit, onSuccess: vi.fn(), onError: vi.fn() }))
    expect(commit).not.toHaveBeenCalled()
    expect((result.current.dialog as ReactElement<{ removals: FollowerRemoval[] }>).props.removals).toEqual(list)

    await act(() => confirmDialog(result.current.dialog))
    expect(commit).toHaveBeenCalledWith([{ taskId: 't1', userId: 'u1' }, { taskId: 's1', userId: 'u1' }])
    expect(result.current.dialog).toBeFalsy()
  })

  it('backend báo có người mới chưa xác nhận ⇒ xem trước lại và hỏi lại với danh sách mới', async () => {
    const first = [removal('t1', 'u1')]
    const second = [removal('t1', 'u1'), removal('s2', 'u2', true)]
    const preview = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const commit = vi.fn().mockRejectedValueOnce(unconfirmed()).mockResolvedValueOnce('ok')
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const { result } = renderHook(() => useFollowerRemovalConfirm())

    await act(() => result.current.start({ preview, commit, onSuccess, onError }))
    await act(() => confirmDialog(result.current.dialog))
    expect(preview).toHaveBeenCalledTimes(2)
    expect(onError).not.toHaveBeenCalled()
    expect((result.current.dialog as ReactElement<{ removals: FollowerRemoval[] }>).props.removals).toEqual(second)

    await act(() => confirmDialog(result.current.dialog))
    expect(commit).toHaveBeenLastCalledWith([{ taskId: 't1', userId: 'u1' }, { taskId: 's2', userId: 'u2' }])
    expect(onSuccess).toHaveBeenCalledWith('ok')
  })

  it('lỗi khác ⇒ báo lỗi, đóng hộp, không thử lại', async () => {
    const err = new Error('boom')
    const preview = vi.fn().mockResolvedValue([removal('t1', 'u1')])
    const onError = vi.fn()
    const { result } = renderHook(() => useFollowerRemovalConfirm())
    await act(() => result.current.start({ preview, commit: vi.fn().mockRejectedValue(err), onSuccess: vi.fn(), onError }))
    await act(() => confirmDialog(result.current.dialog))
    expect(onError).toHaveBeenCalledWith(err)
    expect(preview).toHaveBeenCalledTimes(1)
    expect(result.current.dialog).toBeFalsy()
  })
})
